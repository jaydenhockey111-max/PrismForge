-- Run after 20260717230826_database_integrity_hardening.sql.
-- Read-only verification; every returned count must be zero.

select 'project_owner_mismatch' as check_name, count(*) as failures
from (
  select c.user_id, c.project_id from public.project_outputs c join public.opportunity_projects p on p.id=c.project_id where c.user_id<>p.user_id
  union all
  select c.user_id, c.project_id from public.project_validation_experiments c join public.opportunity_projects p on p.id=c.project_id where c.user_id<>p.user_id
  union all
  select c.user_id, c.project_id from public.project_assumptions c join public.opportunity_projects p on p.id=c.project_id where c.user_id<>p.user_id
  union all
  select c.user_id, c.project_id from public.validation_paths c join public.opportunity_projects p on p.id=c.project_id where c.user_id<>p.user_id
  union all
  select c.user_id, c.project_id from public.project_decisions c join public.opportunity_projects p on p.id=c.project_id where c.user_id<>p.user_id
) mismatches
union all
select 'experiment_assumption_mismatch', count(*)
from public.project_validation_experiments e
join public.project_assumptions a on a.id=e.target_assumption_id
where e.project_id<>a.project_id or e.user_id<>a.user_id
union all
select 'experiment_path_mismatch', count(*)
from public.project_validation_experiments e
join public.validation_paths p on p.id=e.validation_path_id
where e.project_id<>p.project_id or e.user_id<>p.user_id
union all
select 'decision_assumption_mismatch', count(*)
from public.project_decisions d
join public.project_assumptions a on a.id=d.assumption_id
where d.project_id<>a.project_id or d.user_id<>a.user_id
union all
select 'decision_experiment_mismatch', count(*)
from public.project_decisions d
join public.project_validation_experiments e on e.id=d.experiment_id
where d.project_id<>e.project_id or d.user_id<>e.user_id
union all
select 'invalid_current_focus', count(*)
from public.founder_project_focus f
left join public.opportunity_projects p on p.id=f.project_id
where p.id is null or p.user_id<>f.user_id or p.deleted_at is not null or p.lifecycle_status<>'active'
union all
select 'duplicate_generation_request', count(*)
from (
  select user_id,request_id
  from public.generation_history
  where request_id is not null
  group by user_id,request_id
  having count(*)>1
) duplicates;

select
  has_function_privilege('anon', 'public.create_founder_project_atomic(text,text,text,text,integer,jsonb,jsonb)', 'execute')
    as anon_can_create_project,
  has_function_privilege('authenticated', 'public.create_founder_project_atomic(text,text,text,text,integer,jsonb,jsonb)', 'execute')
    as authenticated_can_create_project;
