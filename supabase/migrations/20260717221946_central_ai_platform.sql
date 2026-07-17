-- Central, server-only AI request ledger, exact cache, runtime controls, and atomic reservation.

create table if not exists public.ai_runtime_controls (
  control_key text primary key,
  enabled boolean not null default true,
  numeric_value numeric(14, 6),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_runtime_controls (control_key, enabled, note)
values
  ('global', true, 'Global AI kill switch'),
  ('provider:openai', true, 'OpenAI provider kill switch'),
  ('route:openai_fast', true, 'Fast route kill switch'),
  ('route:openai_balanced', true, 'Balanced route kill switch'),
  ('route:openai_deep', false, 'Deep route is disabled until explicitly approved'),
  ('task:opportunity_report', true, 'Opportunity report task'),
  ('task:ceo_ai', true, 'CEO specialist task'),
  ('task:marketer_ai', true, 'Marketing specialist task'),
  ('task:designer_ai', true, 'Design specialist task'),
  ('task:engineer_ai', true, 'Engineering specialist task'),
  ('task:validation_survey', true, 'Validation survey task'),
  ('task:competitive_battlecard', true, 'Competitive battlecard task'),
  ('task:pricing_tiers', true, 'Pricing tiers task'),
  ('task:video_scripts', true, 'Video scripts task'),
  ('task:sprint_tasks', true, 'Sprint tasks task')
on conflict (control_key) do nothing;

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.opportunity_projects(id) on delete set null,
  project_scope text generated always as (coalesce(project_id::text, 'new-project')) stored,
  task_id text not null,
  request_id uuid not null,
  idempotency_key_hash text not null check (char_length(idempotency_key_hash) = 64),
  input_hash text not null check (char_length(input_hash) = 64),
  provider text not null,
  model_route text not null,
  model_id text not null,
  prompt_version text not null,
  schema_version text not null,
  status text not null check (status in (
    'reserved', 'completed', 'failed', 'cached', 'blocked', 'reconciliation_needed'
  )),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  reserved_cost_usd numeric(14, 8) not null default 0 check (reserved_cost_usd >= 0),
  actual_cost_usd numeric(14, 8) check (actual_cost_usd is null or actual_cost_usd >= 0),
  result_json jsonb,
  provider_request_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  cache_hit boolean not null default false,
  failure_category text,
  failure_reason text,
  retryable boolean not null default false,
  synthetic boolean not null default false,
  source text not null default 'server_action',
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  cache_expires_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_id, project_scope, idempotency_key_hash)
);

create index if not exists ai_requests_user_task_created_idx
on public.ai_requests(user_id, task_id, created_at desc);

create index if not exists ai_requests_project_task_created_idx
on public.ai_requests(project_id, task_id, created_at desc);

create index if not exists ai_requests_status_created_idx
on public.ai_requests(status, created_at desc);

create index if not exists ai_requests_cache_lookup_idx
on public.ai_requests(user_id, task_id, project_scope, input_hash, created_at desc)
where status = 'completed' and result_json is not null;

alter table public.ai_requests enable row level security;
alter table public.ai_runtime_controls enable row level security;

revoke all on public.ai_requests from public, anon, authenticated;
revoke all on public.ai_runtime_controls from public, anon, authenticated;
grant select, insert, update on public.ai_requests to service_role;
grant select, insert, update on public.ai_runtime_controls to service_role;

create or replace function public.reserve_ai_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_task_id text;
  v_request_id uuid;
  v_project_scope text;
  v_existing public.ai_requests%rowtype;
  v_ledger_id uuid;
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_task_daily integer;
  v_task_monthly integer;
  v_user_daily integer;
  v_user_monthly integer;
  v_daily_cost numeric;
  v_monthly_cost numeric;
  v_reserved_cost numeric;
  v_reason text;
  v_category text := 'limit';
begin
  v_user_id := (p_request->>'user_id')::uuid;
  v_project_id := nullif(p_request->>'project_id', '')::uuid;
  v_task_id := p_request->>'task_id';
  v_request_id := (p_request->>'request_id')::uuid;
  v_project_scope := coalesce(v_project_id::text, 'new-project');
  v_reserved_cost := greatest(coalesce((p_request->>'reserved_cost_usd')::numeric, 0), 0);

  perform pg_advisory_xact_lock(hashtextextended('prismforge-ai-global', 0));
  perform pg_advisory_xact_lock(hashtextextended('prismforge-ai-user:' || v_user_id::text, 0));

  if not exists (select 1 from public.profiles where id = v_user_id) then
    return jsonb_build_object('decision', 'blocked', 'reason', 'Authenticated profile not found.', 'category', 'authentication');
  end if;

  if coalesce((p_request->>'requires_project')::boolean, false) and (
    v_project_id is null or not exists (
      select 1
      from public.opportunity_projects
      where id = v_project_id
        and user_id = v_user_id
        and deleted_at is null
        and lifecycle_status = 'active'
    )
  ) then
    return jsonb_build_object('decision', 'blocked', 'reason', 'Project authorization failed.', 'category', 'authorization');
  end if;

  select * into v_existing
  from public.ai_requests
  where user_id = v_user_id
    and task_id = v_task_id
    and project_scope = v_project_scope
    and idempotency_key_hash = p_request->>'idempotency_key_hash'
  limit 1;

  if found then
    return jsonb_build_object(
      'decision', 'duplicate',
      'ledger_id', v_existing.id,
      'status', v_existing.status,
      'result', v_existing.result_json
    );
  end if;

  if coalesce((p_request->>'cache_bypass')::boolean, false) = false then
    select * into v_existing
    from public.ai_requests
    where user_id = v_user_id
      and task_id = v_task_id
      and project_scope = v_project_scope
      and input_hash = p_request->>'input_hash'
      and prompt_version = p_request->>'prompt_version'
      and schema_version = p_request->>'schema_version'
      and model_id = p_request->>'model_id'
      and status = 'completed'
      and result_json is not null
      and cache_expires_at > v_now
    order by completed_at desc
    limit 1;

    if found then
      insert into public.ai_requests (
        user_id, project_id, task_id, request_id, idempotency_key_hash, input_hash,
        provider, model_route, model_id, prompt_version, schema_version, status,
        result_json, cache_hit, source, synthetic, completed_at
      ) values (
        v_user_id, v_project_id, v_task_id, v_request_id, p_request->>'idempotency_key_hash', p_request->>'input_hash',
        p_request->>'provider', p_request->>'model_route', p_request->>'model_id',
        p_request->>'prompt_version', p_request->>'schema_version', 'cached',
        v_existing.result_json, true, coalesce(p_request->>'source', 'server_action'),
        coalesce((p_request->>'synthetic')::boolean, false), v_now
      ) returning id into v_ledger_id;

      return jsonb_build_object('decision', 'cached', 'ledger_id', v_ledger_id, 'result', v_existing.result_json);
    end if;
  end if;

  select * into v_existing
  from public.ai_requests
  where user_id = v_user_id
    and task_id = v_task_id
    and project_scope = v_project_scope
    and input_hash = p_request->>'input_hash'
    and status = 'reserved'
    and created_at > v_now - interval '10 minutes'
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object('decision', 'duplicate', 'ledger_id', v_existing.id, 'status', v_existing.status);
  end if;

  if not coalesce((select enabled from public.ai_runtime_controls where control_key = 'global'), false)
    or not coalesce((select enabled from public.ai_runtime_controls where control_key = 'provider:' || (p_request->>'provider')), false)
    or not coalesce((select enabled from public.ai_runtime_controls where control_key = 'route:' || (p_request->>'model_route')), false)
    or not coalesce((select enabled from public.ai_runtime_controls where control_key = 'task:' || v_task_id), false)
  then
    v_reason := 'AI generation is temporarily disabled.';
    v_category := 'disabled';
  end if;

  select count(*) filter (where created_at >= v_day_start),
         count(*) filter (where created_at >= v_month_start)
  into v_task_daily, v_task_monthly
  from public.ai_requests
  where user_id = v_user_id
    and task_id = v_task_id
    and status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  select count(*) filter (where created_at >= v_day_start),
         count(*) filter (where created_at >= v_month_start)
  into v_user_daily, v_user_monthly
  from public.ai_requests
  where user_id = v_user_id
    and status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  select
    coalesce(sum(case when created_at >= v_day_start then
      case when status = 'reserved' then reserved_cost_usd else coalesce(actual_cost_usd, reserved_cost_usd) end
    else 0 end), 0),
    coalesce(sum(case when created_at >= v_month_start then
      case when status = 'reserved' then reserved_cost_usd else coalesce(actual_cost_usd, reserved_cost_usd) end
    else 0 end), 0)
  into v_daily_cost, v_monthly_cost
  from public.ai_requests
  where status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  if v_reason is null and (
    v_task_daily >= greatest(coalesce((p_request->>'task_daily_limit')::integer, 0), 0)
    or v_task_monthly >= greatest(coalesce((p_request->>'task_monthly_limit')::integer, 0), 0)
    or v_user_daily >= greatest(coalesce((p_request->>'user_daily_limit')::integer, 0), 0)
    or v_user_monthly >= greatest(coalesce((p_request->>'user_monthly_limit')::integer, 0), 0)
  ) then
    v_reason := 'This AI usage limit has been reached.';
  end if;

  if v_reason is null and (
    v_daily_cost + v_reserved_cost > (p_request->>'global_hard_daily_usd')::numeric
    or v_monthly_cost + v_reserved_cost > (p_request->>'global_hard_monthly_usd')::numeric
  ) then
    v_reason := 'The global AI safety cap has been reached.';
  end if;

  if v_reason is not null then
    insert into public.ai_requests (
      user_id, project_id, task_id, request_id, idempotency_key_hash, input_hash,
      provider, model_route, model_id, prompt_version, schema_version, status,
      reserved_cost_usd, failure_category, failure_reason, source, synthetic, completed_at
    ) values (
      v_user_id, v_project_id, v_task_id, v_request_id, p_request->>'idempotency_key_hash', p_request->>'input_hash',
      p_request->>'provider', p_request->>'model_route', p_request->>'model_id',
      p_request->>'prompt_version', p_request->>'schema_version', 'blocked',
      0, v_category, v_reason, coalesce(p_request->>'source', 'server_action'),
      coalesce((p_request->>'synthetic')::boolean, false), v_now
    ) returning id into v_ledger_id;
    return jsonb_build_object('decision', 'blocked', 'ledger_id', v_ledger_id, 'reason', v_reason, 'category', v_category);
  end if;

  insert into public.ai_requests (
    user_id, project_id, task_id, request_id, idempotency_key_hash, input_hash,
    provider, model_route, model_id, prompt_version, schema_version, status,
    estimated_input_tokens, estimated_output_tokens, reserved_cost_usd,
    cache_expires_at, source, synthetic
  ) values (
    v_user_id, v_project_id, v_task_id, v_request_id, p_request->>'idempotency_key_hash', p_request->>'input_hash',
    p_request->>'provider', p_request->>'model_route', p_request->>'model_id',
    p_request->>'prompt_version', p_request->>'schema_version', 'reserved',
    greatest(coalesce((p_request->>'estimated_input_tokens')::integer, 0), 0),
    greatest(coalesce((p_request->>'estimated_output_tokens')::integer, 0), 0),
    v_reserved_cost,
    v_now + make_interval(secs => greatest(coalesce((p_request->>'cache_ttl_seconds')::integer, 0), 0)),
    coalesce(p_request->>'source', 'server_action'),
    coalesce((p_request->>'synthetic')::boolean, false)
  ) returning id into v_ledger_id;

  return jsonb_build_object('decision', 'reserved', 'ledger_id', v_ledger_id);
exception
  when unique_violation then
    select * into v_existing
    from public.ai_requests
    where user_id = v_user_id
      and task_id = v_task_id
      and project_scope = v_project_scope
      and idempotency_key_hash = p_request->>'idempotency_key_hash'
    limit 1;
    return jsonb_build_object('decision', 'duplicate', 'ledger_id', v_existing.id, 'status', v_existing.status, 'result', v_existing.result_json);
  when others then
    return jsonb_build_object('decision', 'blocked', 'reason', 'AI safety accounting rejected the request.', 'category', 'repository_unavailable');
end;
$$;

create or replace function public.finalize_ai_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_requests%rowtype;
  v_status text := p_request->>'status';
begin
  select * into v_row
  from public.ai_requests
  where id = (p_request->>'ledger_id')::uuid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_row.status <> 'reserved' then
    return jsonb_build_object('ok', v_row.status = v_status, 'reason', 'already_finalized');
  end if;
  if v_status not in ('completed', 'failed', 'reconciliation_needed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  update public.ai_requests
  set status = v_status,
      input_tokens = greatest(coalesce((p_request->>'input_tokens')::integer, 0), 0),
      output_tokens = greatest(coalesce((p_request->>'output_tokens')::integer, 0), 0),
      cached_input_tokens = greatest(coalesce((p_request->>'cached_input_tokens')::integer, 0), 0),
      actual_cost_usd = nullif(p_request->>'actual_cost_usd', '')::numeric,
      result_json = case when v_status = 'completed' then p_request->'result' else null end,
      provider_request_id = nullif(p_request->>'provider_request_id', ''),
      attempt_count = greatest(coalesce((p_request->>'attempt_count')::integer, 0), 0),
      latency_ms = greatest(coalesce((p_request->>'latency_ms')::integer, 0), 0),
      failure_category = nullif(p_request->>'failure_category', ''),
      retryable = coalesce((p_request->>'retryable')::boolean, false),
      completed_at = now(),
      updated_at = now()
  where id = v_row.id;

  insert into public.app_events(user_id, event_name, metadata)
  values (
    v_row.user_id,
    'ai_request_' || v_status,
    jsonb_build_object(
      'request_id', v_row.request_id,
      'task_id', v_row.task_id,
      'project_id', v_row.project_id,
      'route', v_row.model_route,
      'model', v_row.model_id,
      'status', v_status,
      'cache_hit', false,
      'input_tokens', greatest(coalesce((p_request->>'input_tokens')::integer, 0), 0),
      'output_tokens', greatest(coalesce((p_request->>'output_tokens')::integer, 0), 0),
      'actual_cost_usd', nullif(p_request->>'actual_cost_usd', '')::numeric,
      'failure_category', nullif(p_request->>'failure_category', '')
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reserve_ai_request(jsonb) from public, anon, authenticated;
revoke all on function public.finalize_ai_request(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(jsonb) to service_role;
grant execute on function public.finalize_ai_request(jsonb) to service_role;

comment on table public.ai_requests is
'Server-only financial AI ledger and exact private cache. Never expose result_json, hashes, provider IDs, or cost fields directly to ordinary users.';
