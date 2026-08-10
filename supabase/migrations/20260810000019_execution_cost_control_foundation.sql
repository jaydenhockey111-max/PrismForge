-- Server-only autonomous execution ledger. It is intentionally separate from ai_requests:
-- ordinary AI generation remains cheap and does not enter this lifecycle.

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free','premium','founder'));

create table if not exists public.execution_budget_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.opportunity_projects(id) on delete set null,
  request_id uuid not null,
  execution_type text not null check (char_length(execution_type) between 3 and 120),
  status text not null check (status in ('reserved','running','completed','failed','cancelled','released','blocked')),
  approval_required boolean not null default false,
  reserved_budget_usd numeric(12,6) not null default 0 check (reserved_budget_usd >= 0),
  internal_actual_cost_usd numeric(12,6) not null default 0 check (internal_actual_cost_usd >= 0),
  customer_allowance_consumed_usd numeric(12,6) not null default 0 check (customer_allowance_consumed_usd >= 0),
  model_calls integer not null default 0 check (model_calls >= 0),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  retries integer not null default 0 check (retries >= 0),
  steps integer not null default 0 check (steps >= 0),
  termination_reason text,
  started_at timestamptz not null default now(),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index if not exists execution_budget_ledger_user_period_idx
  on public.execution_budget_ledger(user_id, created_at desc, status);
create index if not exists execution_budget_ledger_project_idx
  on public.execution_budget_ledger(project_id, created_at desc) where project_id is not null;

alter table public.execution_budget_ledger enable row level security;
revoke all on public.execution_budget_ledger from public, anon, authenticated;
grant select, insert, update on public.execution_budget_ledger to service_role;

create or replace function public.reserve_execution_budget(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (p_request->>'user_id')::uuid;
  v_project_id uuid := nullif(p_request->>'project_id','')::uuid;
  v_request_id uuid := (p_request->>'request_id')::uuid;
  v_estimated numeric := greatest(coalesce((p_request->>'estimated_cost_usd')::numeric, 0), 0);
  v_policy_max numeric := greatest(coalesce((p_request->>'policy_max_budget_usd')::numeric, 0), 0);
  v_allowance numeric := greatest(coalesce((p_request->>'monthly_allowance_usd')::numeric, 0), 0);
  v_used numeric := 0;
  v_existing public.execution_budget_ledger%rowtype;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('prismforge-execution-user:' || v_user_id::text, 0));

  if v_user_id is null or v_request_id is null or not exists (select 1 from public.profiles where id = v_user_id) then
    return jsonb_build_object('decision','blocked','reason','AUTHORIZATION');
  end if;
  if v_project_id is not null and not exists (select 1 from public.opportunity_projects where id = v_project_id and user_id = v_user_id and deleted_at is null) then
    return jsonb_build_object('decision','blocked','reason','AUTHORIZATION');
  end if;

  select * into v_existing from public.execution_budget_ledger where user_id = v_user_id and request_id = v_request_id;
  if found then
    return jsonb_build_object('decision',case when v_existing.status in ('reserved','running') then 'reserved' else 'blocked' end,'reservation_id',v_existing.id,'reserved_budget_usd',v_existing.reserved_budget_usd,'remaining_monthly_allowance_usd',greatest(0, v_allowance - v_existing.customer_allowance_consumed_usd),'reason',case when v_existing.status in ('reserved','running') then null else 'DUPLICATE_REQUEST' end);
  end if;

  if v_estimated <= 0 or v_estimated > v_policy_max then
    return jsonb_build_object('decision','blocked','reason','JOB_BUDGET_EXCEEDED');
  end if;

  select coalesce(sum(case when status in ('reserved','running') then reserved_budget_usd else customer_allowance_consumed_usd end), 0)
  into v_used
  from public.execution_budget_ledger
  where user_id = v_user_id and created_at >= date_trunc('month', now()) and status <> 'blocked';

  if v_used + v_estimated > v_allowance then
    return jsonb_build_object('decision','blocked','reason','MONTHLY_LIMIT');
  end if;

  insert into public.execution_budget_ledger(user_id,project_id,request_id,execution_type,status,approval_required,reserved_budget_usd)
  values(v_user_id,v_project_id,v_request_id,p_request->>'execution_type','reserved',coalesce((p_request->>'approval_required')::boolean,false),v_estimated)
  returning id into v_id;

  insert into public.app_events(user_id,event_name,metadata)
  values(v_user_id,'execution_budget_reserved',jsonb_build_object('request_id',v_request_id,'execution_type',p_request->>'execution_type','reserved_budget_usd',v_estimated));

  return jsonb_build_object('decision','reserved','reservation_id',v_id,'reserved_budget_usd',v_estimated,'remaining_monthly_allowance_usd',greatest(0, v_allowance - v_used - v_estimated));
exception when unique_violation then
  select * into v_existing from public.execution_budget_ledger where user_id = v_user_id and request_id = v_request_id;
  return jsonb_build_object('decision','reserved','reservation_id',v_existing.id,'reserved_budget_usd',v_existing.reserved_budget_usd,'remaining_monthly_allowance_usd',0);
end;
$$;

create or replace function public.record_execution_usage(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.execution_budget_ledger%rowtype; v_internal numeric := greatest(coalesce((p_request->>'internal_actual_cost_usd')::numeric,0),0); v_customer numeric := greatest(coalesce((p_request->>'customer_allowance_consumed_usd')::numeric,0),0);
begin
  select * into v_row from public.execution_budget_ledger where id = (p_request->>'reservation_id')::uuid for update;
  if not found or v_row.status not in ('reserved','running') then return jsonb_build_object('ok',false); end if;
  update public.execution_budget_ledger set status='running', internal_actual_cost_usd=greatest(internal_actual_cost_usd,v_internal), customer_allowance_consumed_usd=least(reserved_budget_usd,greatest(customer_allowance_consumed_usd,v_customer)), model_calls=greatest(model_calls,coalesce((p_request->>'model_calls')::integer,0)), tool_calls=greatest(tool_calls,coalesce((p_request->>'tool_calls')::integer,0)), retries=greatest(retries,coalesce((p_request->>'retries')::integer,0)), steps=greatest(steps,coalesce((p_request->>'steps')::integer,0)), updated_at=now() where id=v_row.id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.start_execution_budget(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.execution_budget_ledger%rowtype;
begin
  select * into v_row from public.execution_budget_ledger where id = (p_request->>'reservation_id')::uuid for update;
  if not found or v_row.status <> 'reserved' then return jsonb_build_object('ok',false); end if;
  update public.execution_budget_ledger set status='running', updated_at=now() where id=v_row.id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.finalize_execution_budget(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.execution_budget_ledger%rowtype; v_status text := p_request->>'status';
begin
  select * into v_row from public.execution_budget_ledger where id = (p_request->>'reservation_id')::uuid for update;
  if not found then return jsonb_build_object('ok',false,'reason','NOT_FOUND'); end if;
  if v_row.status not in ('reserved','running') then return jsonb_build_object('ok',true,'reason','ALREADY_FINALIZED'); end if;
  if v_status not in ('completed','failed','cancelled','released') then return jsonb_build_object('ok',false,'reason','INVALID_STATUS'); end if;
  update public.execution_budget_ledger set status=v_status, termination_reason=nullif(p_request->>'termination_reason',''), finalized_at=now(), updated_at=now() where id=v_row.id;
  insert into public.app_events(user_id,event_name,metadata) values(v_row.user_id,'execution_budget_finalized',jsonb_build_object('request_id',v_row.request_id,'execution_type',v_row.execution_type,'status',v_status,'termination_reason',p_request->>'termination_reason','reserved_budget_usd',v_row.reserved_budget_usd,'internal_actual_cost_usd',v_row.internal_actual_cost_usd,'customer_allowance_consumed_usd',v_row.customer_allowance_consumed_usd,'model_calls',v_row.model_calls,'tool_calls',v_row.tool_calls,'retries',v_row.retries,'steps',v_row.steps));
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.reserve_execution_budget(jsonb) from public, anon, authenticated;
revoke all on function public.record_execution_usage(jsonb) from public, anon, authenticated;
revoke all on function public.start_execution_budget(jsonb) from public, anon, authenticated;
revoke all on function public.finalize_execution_budget(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_execution_budget(jsonb) to service_role;
grant execute on function public.record_execution_usage(jsonb) to service_role;
grant execute on function public.start_execution_budget(jsonb) to service_role;
grant execute on function public.finalize_execution_budget(jsonb) to service_role;

comment on table public.execution_budget_ledger is 'Server-only reserve -> spend -> release ledger for future autonomous execution. Never expose cost fields or reservation RPCs to clients.';
