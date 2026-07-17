-- Failed provider attempts may carry financial cost, but do not consume user generation quota.
-- Reconciliation-needed rows remain reserved against quota until their billing state is resolved.

alter function public.reserve_ai_request(jsonb) rename to reserve_ai_request_limits;

create or replace function public.reserve_ai_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (p_request->>'user_id')::uuid;
  v_task_id text := p_request->>'task_id';
  v_task_failed_day integer;
  v_task_failed_month integer;
  v_user_failed_day integer;
  v_user_failed_month integer;
  v_adjusted jsonb;
begin
  select
    count(*) filter (where created_at >= date_trunc('day', now())),
    count(*) filter (where created_at >= date_trunc('month', now()))
  into v_task_failed_day, v_task_failed_month
  from public.ai_requests
  where user_id = v_user_id
    and task_id = v_task_id
    and status = 'failed';

  select
    count(*) filter (where created_at >= date_trunc('day', now())),
    count(*) filter (where created_at >= date_trunc('month', now()))
  into v_user_failed_day, v_user_failed_month
  from public.ai_requests
  where user_id = v_user_id
    and status = 'failed';

  v_adjusted := p_request || jsonb_build_object(
    'task_daily_limit', coalesce((p_request->>'task_daily_limit')::integer, 0) + v_task_failed_day,
    'task_monthly_limit', coalesce((p_request->>'task_monthly_limit')::integer, 0) + v_task_failed_month,
    'user_daily_limit', coalesce((p_request->>'user_daily_limit')::integer, 0) + v_user_failed_day,
    'user_monthly_limit', coalesce((p_request->>'user_monthly_limit')::integer, 0) + v_user_failed_month
  );

  return public.reserve_ai_request_limits(v_adjusted);
end;
$$;

revoke all on function public.reserve_ai_request_limits(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.reserve_ai_request(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(jsonb) to service_role;
