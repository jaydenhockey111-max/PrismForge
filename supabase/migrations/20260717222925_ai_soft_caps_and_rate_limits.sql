-- Add atomic burst/sustained throughput limits and controlled soft-cap degradation.
-- The core reservation function retains the advisory locks for the wrapper transaction.

alter function public.reserve_ai_request(jsonb) rename to reserve_ai_request_core;

create or replace function public.reserve_ai_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_ledger_id uuid;
  v_user_id uuid := (p_request->>'user_id')::uuid;
  v_task_id text := p_request->>'task_id';
  v_burst_count integer;
  v_sustained_count integer;
  v_global_count integer;
  v_daily_cost numeric;
  v_monthly_cost numeric;
  v_reason text;
  v_category text;
begin
  v_result := public.reserve_ai_request_core(p_request);
  if v_result->>'decision' <> 'reserved' then return v_result; end if;

  v_ledger_id := (v_result->>'ledger_id')::uuid;

  select
    count(*) filter (where created_at >= now() - interval '1 minute'),
    count(*) filter (where created_at >= now() - interval '10 minutes')
  into v_burst_count, v_sustained_count
  from public.ai_requests
  where user_id = v_user_id
    and task_id = v_task_id
    and status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  select count(*) into v_global_count
  from public.ai_requests
  where created_at >= now() - interval '1 minute'
    and status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  select
    coalesce(sum(case when created_at >= date_trunc('day', now()) then
      case when status = 'reserved' then reserved_cost_usd else coalesce(actual_cost_usd, reserved_cost_usd) end
    else 0 end), 0),
    coalesce(sum(case when created_at >= date_trunc('month', now()) then
      case when status = 'reserved' then reserved_cost_usd else coalesce(actual_cost_usd, reserved_cost_usd) end
    else 0 end), 0)
  into v_daily_cost, v_monthly_cost
  from public.ai_requests
  where status in ('reserved', 'completed', 'failed', 'reconciliation_needed');

  if v_burst_count > greatest(coalesce((p_request->>'task_burst_limit')::integer, 1), 1)
    or v_sustained_count > greatest(coalesce((p_request->>'task_sustained_limit')::integer, 1), 1)
    or v_global_count > greatest(coalesce((p_request->>'global_requests_per_minute')::integer, 1), 1)
  then
    v_reason := 'This AI task is receiving too many requests. Try again shortly.';
    v_category := 'limit';
  elsif (
    v_daily_cost > coalesce((p_request->>'global_soft_daily_usd')::numeric, 0)
    or v_monthly_cost > coalesce((p_request->>'global_soft_monthly_usd')::numeric, 0)
  ) and p_request->>'model_route' <> 'openai_fast'
  then
    v_reason := 'AI capacity is temporarily limited. PrismForge used its reliable local version.';
    v_category := 'soft_cap';
    insert into public.app_events(user_id, event_name, metadata)
    values (v_user_id, 'ai_global_soft_cap_reached', jsonb_build_object(
      'request_id', p_request->>'request_id',
      'task_id', v_task_id,
      'route', p_request->>'model_route'
    ));
  end if;

  if v_reason is null then return v_result; end if;

  update public.ai_requests
  set status = 'blocked',
      reserved_cost_usd = 0,
      failure_category = v_category,
      failure_reason = v_reason,
      completed_at = now(),
      updated_at = now()
  where id = v_ledger_id
    and status = 'reserved';

  return jsonb_build_object(
    'decision', 'blocked',
    'ledger_id', v_ledger_id,
    'reason', v_reason,
    'category', v_category
  );
end;
$$;

revoke all on function public.reserve_ai_request_core(jsonb) from public, anon, authenticated;
revoke all on function public.reserve_ai_request_core(jsonb) from service_role;
revoke all on function public.reserve_ai_request(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(jsonb) to service_role;
