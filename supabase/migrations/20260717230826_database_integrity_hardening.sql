-- PrismForge database integrity hardening.
-- Forward-only, additive correction for ownership consistency and atomic project creation.

begin;

-- Fail before installing enforcement if production already contains inconsistent rows.
do $$
declare
  mismatch_count bigint;
begin
  select count(*)
    into mismatch_count
    from (
      select c.user_id, c.project_id
      from public.project_outputs c
      join public.opportunity_projects p on p.id = c.project_id
      where c.user_id <> p.user_id
      union all
      select c.user_id, c.project_id
      from public.project_validation_experiments c
      join public.opportunity_projects p on p.id = c.project_id
      where c.user_id <> p.user_id
      union all
      select c.user_id, c.project_id
      from public.project_assumptions c
      join public.opportunity_projects p on p.id = c.project_id
      where c.user_id <> p.user_id
      union all
      select c.user_id, c.project_id
      from public.validation_paths c
      join public.opportunity_projects p on p.id = c.project_id
      where c.user_id <> p.user_id
      union all
      select c.user_id, c.project_id
      from public.project_decisions c
      join public.opportunity_projects p on p.id = c.project_id
      where c.user_id <> p.user_id
    ) mismatches;

  if mismatch_count > 0 then
    raise exception 'Ownership preflight failed: % project-scoped rows do not match their project owner.', mismatch_count;
  end if;
end
$$;

create or replace function public.enforce_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.opportunity_projects project
    where project.id = new.project_id
      and project.user_id = new.user_id
  ) then
    raise exception using
      errcode = '23503',
      message = format('%s project ownership does not match user_id.', tg_table_name);
  end if;

  return new;
end
$$;

comment on function public.enforce_project_owner() is
  'Rejects project-scoped rows whose user_id differs from the canonical opportunity_projects owner.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_requests',
    'core_value_feedback',
    'feature_usage_events',
    'founder_pattern_insight_sources',
    'founder_project_focus',
    'founder_project_learning_snapshots',
    'founder_timeline_events',
    'founder_validation_preferences',
    'generation_history',
    'progression_flags',
    'project_assumptions',
    'project_closure_reflections',
    'project_decisions',
    'project_lifecycle_events',
    'project_outputs',
    'project_stage_history',
    'project_validation_experiments',
    'validation_path_events',
    'validation_paths',
    'xp_events'
  ]
  loop
    execute format('drop trigger if exists enforce_project_owner on public.%I', table_name);
    execute format(
      'create trigger enforce_project_owner before insert or update of user_id, project_id on public.%I for each row execute function public.enforce_project_owner()',
      table_name
    );
  end loop;
end
$$;

create or replace function public.enforce_validation_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'project_validation_experiments' then
    if new.validation_path_id is not null and not exists (
      select 1 from public.validation_paths path
      where path.id = new.validation_path_id
        and path.project_id = new.project_id
        and path.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Validation path must belong to the same project and user.';
    end if;
    if new.target_assumption_id is not null and not exists (
      select 1 from public.project_assumptions assumption
      where assumption.id = new.target_assumption_id
        and assumption.project_id = new.project_id
        and assumption.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Target assumption must belong to the same project and user.';
    end if;
  elsif tg_table_name = 'validation_path_events' then
    if new.validation_path_id is not null and not exists (
      select 1 from public.validation_paths path
      where path.id = new.validation_path_id
        and path.project_id = new.project_id
        and path.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Path event must reference a path in the same project and user.';
    end if;
  elsif tg_table_name = 'project_decisions' then
    if new.validation_path_id is not null and not exists (
      select 1 from public.validation_paths path
      where path.id = new.validation_path_id
        and path.project_id = new.project_id
        and path.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Decision path must belong to the same project and user.';
    end if;
    if new.assumption_id is not null and not exists (
      select 1 from public.project_assumptions assumption
      where assumption.id = new.assumption_id
        and assumption.project_id = new.project_id
        and assumption.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Decision assumption must belong to the same project and user.';
    end if;
    if new.experiment_id is not null and not exists (
      select 1 from public.project_validation_experiments experiment
      where experiment.id = new.experiment_id
        and experiment.project_id = new.project_id
        and experiment.user_id = new.user_id
    ) then
      raise exception using errcode = '23503', message = 'Decision experiment must belong to the same project and user.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists enforce_validation_links on public.project_validation_experiments;
create trigger enforce_validation_links
before insert or update of user_id, project_id, validation_path_id, target_assumption_id
on public.project_validation_experiments
for each row execute function public.enforce_validation_links();

drop trigger if exists enforce_validation_links on public.validation_path_events;
create trigger enforce_validation_links
before insert or update of user_id, project_id, validation_path_id
on public.validation_path_events
for each row execute function public.enforce_validation_links();

drop trigger if exists enforce_validation_links on public.project_decisions;
create trigger enforce_validation_links
before insert or update of user_id, project_id, validation_path_id, assumption_id, experiment_id
on public.project_decisions
for each row execute function public.enforce_validation_links();

-- The project, generation history, lifecycle event, and current focus now commit together.
create or replace function public.create_founder_project_atomic(
  p_request_id text,
  p_title text,
  p_business_type text,
  p_target_customer text,
  p_score integer,
  p_report_json jsonb,
  p_input_json jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  project_id uuid;
  request_uuid uuid;
begin
  if actor is null then
    raise exception 'Authenticated user required.';
  end if;
  if p_request_id is null or p_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'A valid request id is required.';
  end if;
  request_uuid := p_request_id::uuid;

  select history.project_id
    into project_id
    from public.generation_history history
    where history.user_id = actor
      and history.request_id = p_request_id
      and history.project_id is not null
    limit 1;

  if project_id is not null then
    return project_id;
  end if;

  insert into public.opportunity_projects (
    user_id, title, business_type, target_customer, score, report_json
  )
  values (
    actor, p_title, p_business_type, p_target_customer, p_score, p_report_json
  )
  returning id into project_id;

  insert into public.generation_history (
    user_id, request_id, project_id, input_json, output_json
  )
  values (
    actor, p_request_id, project_id, p_input_json, p_report_json
  );

  perform public.register_project_creation_lifecycle(project_id, request_uuid);
  return project_id;
exception
  when unique_violation then
    select history.project_id
      into project_id
      from public.generation_history history
      where history.user_id = actor
        and history.request_id = p_request_id
        and history.project_id is not null
      limit 1;
    if project_id is not null then
      return project_id;
    end if;
    raise;
end
$$;

revoke all on function public.create_founder_project_atomic(text, text, text, text, integer, jsonb, jsonb)
  from public, anon;
grant execute on function public.create_founder_project_atomic(text, text, text, text, integer, jsonb, jsonb)
  to authenticated;

-- Remove anonymous table access from the private founder core.
revoke all on public.opportunity_projects,
  public.generation_history,
  public.project_outputs,
  public.project_validation_experiments,
  public.project_assumptions,
  public.validation_paths,
  public.validation_path_events,
  public.project_decisions,
  public.founder_project_focus,
  public.project_lifecycle_events,
  public.founder_timeline_events,
  public.xp_events,
  public.user_xp,
  public.subscriptions,
  public.profiles
from anon;

-- Append-only and server-owned records should not advertise unused write privileges.
revoke update, delete, truncate on public.generation_history from authenticated;
revoke insert, update, delete, truncate on public.user_xp, public.subscriptions from authenticated;
revoke update, delete, truncate on public.project_decisions, public.validation_path_events from authenticated;

-- Proven foreign-key and history access paths. Avoid indexing tiny/bounded lookup tables.
create index if not exists ai_runtime_controls_updated_by_idx
  on public.ai_runtime_controls(updated_by) where updated_by is not null;
create index if not exists app_events_user_created_idx
  on public.app_events(user_id, created_at desc) where user_id is not null;
create index if not exists project_validation_experiments_assumption_idx
  on public.project_validation_experiments(target_assumption_id) where target_assumption_id is not null;
create index if not exists project_decisions_assumption_idx
  on public.project_decisions(assumption_id) where assumption_id is not null;
create index if not exists project_decisions_experiment_idx
  on public.project_decisions(experiment_id) where experiment_id is not null;
create index if not exists project_decisions_path_idx
  on public.project_decisions(validation_path_id) where validation_path_id is not null;
create index if not exists validation_path_events_path_idx
  on public.validation_path_events(validation_path_id) where validation_path_id is not null;
create index if not exists founder_timeline_lifecycle_idx
  on public.founder_timeline_events(lifecycle_event_id) where lifecycle_event_id is not null;
create index if not exists founder_timeline_path_idx
  on public.founder_timeline_events(validation_path_id) where validation_path_id is not null;
create index if not exists founder_timeline_xp_idx
  on public.founder_timeline_events(xp_event_id) where xp_event_id is not null;

commit;
