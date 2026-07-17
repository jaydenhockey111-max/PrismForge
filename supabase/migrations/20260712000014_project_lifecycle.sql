-- PrismForge Tier 2E: project lifecycle, current focus, recovery, and append-only history.
-- Additive and idempotent. Run after 20260712000013_flexible_validation_paths.sql.

begin;

alter table public.opportunity_projects
  add column if not exists lifecycle_status text,
  add column if not exists last_meaningful_activity_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists resumed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists abandoned_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists recovery_expires_at timestamptz,
  add column if not exists lifecycle_version integer not null default 0;

update public.opportunity_projects
set lifecycle_status = 'archived',
    archived_at = coalesce(archived_at, updated_at, created_at)
where lifecycle_status is null
  and lower(coalesce(report_json->>'lifecycle_status', '')) = 'archived';

update public.opportunity_projects
set lifecycle_status = 'active'
where lifecycle_status is null;

update public.opportunity_projects
set last_meaningful_activity_at = coalesce(last_meaningful_activity_at, updated_at, created_at)
where last_meaningful_activity_at is null;

alter table public.opportunity_projects alter column lifecycle_status set default 'active';
alter table public.opportunity_projects alter column lifecycle_status set not null;
alter table public.opportunity_projects alter column last_meaningful_activity_at set default now();
alter table public.opportunity_projects alter column last_meaningful_activity_at set not null;
alter table public.opportunity_projects drop constraint if exists opportunity_projects_lifecycle_status_check;
alter table public.opportunity_projects add constraint opportunity_projects_lifecycle_status_check
  check (lifecycle_status in ('active','paused','completed','archived','abandoned'));
alter table public.opportunity_projects drop constraint if exists opportunity_projects_lifecycle_version_check;
alter table public.opportunity_projects add constraint opportunity_projects_lifecycle_version_check check (lifecycle_version >= 0);
alter table public.opportunity_projects drop constraint if exists opportunity_projects_recovery_window_check;
alter table public.opportunity_projects add constraint opportunity_projects_recovery_window_check
  check ((deleted_at is null and recovery_expires_at is null) or (deleted_at is not null and recovery_expires_at is not null and recovery_expires_at > deleted_at));

create table if not exists public.founder_project_focus (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  project_id uuid not null unique references public.opportunity_projects(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.opportunity_projects(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('project_created','project_focused','project_unfocused','project_paused','project_resumed','project_completed','project_archived','project_abandoned','project_restored','project_soft_deleted','project_permanently_deleted','project_stage_changed')),
  previous_status text,
  next_status text,
  reason text check (reason is null or char_length(reason) <= 500),
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deleted_project_tombstones (
  project_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permanently_deleted_at timestamptz not null default now()
);

create unique index if not exists project_lifecycle_events_request_idx on public.project_lifecycle_events(user_id, request_id, event_type);
create index if not exists project_lifecycle_events_project_idx on public.project_lifecycle_events(project_id, created_at desc) where project_id is not null;
create index if not exists project_lifecycle_events_user_idx on public.project_lifecycle_events(user_id, created_at desc);
create index if not exists opportunity_projects_user_lifecycle_activity_idx on public.opportunity_projects(user_id, lifecycle_status, last_meaningful_activity_at desc) where deleted_at is null;
create index if not exists opportunity_projects_user_created_live_idx on public.opportunity_projects(user_id, created_at desc) where deleted_at is null;
create index if not exists opportunity_projects_deleted_idx on public.opportunity_projects(user_id, deleted_at desc) where deleted_at is not null;

alter table public.founder_project_focus enable row level security;
alter table public.project_lifecycle_events enable row level security;
alter table public.deleted_project_tombstones enable row level security;

drop policy if exists "Founders read their current project focus" on public.founder_project_focus;
create policy "Founders read their current project focus" on public.founder_project_focus for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Founders read their project lifecycle history" on public.project_lifecycle_events;
create policy "Founders read their project lifecycle history" on public.project_lifecycle_events for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Founders read their deleted project tombstones" on public.deleted_project_tombstones;
create policy "Founders read their deleted project tombstones" on public.deleted_project_tombstones for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());

revoke all on public.founder_project_focus, public.project_lifecycle_events, public.deleted_project_tombstones from anon, authenticated;
grant select on public.founder_project_focus, public.project_lifecycle_events, public.deleted_project_tombstones to authenticated;
grant all on public.founder_project_focus, public.project_lifecycle_events, public.deleted_project_tombstones to service_role;

-- Lifecycle fields are mutated through authenticated RPCs. Existing project editing remains available.
revoke insert, update, delete on public.opportunity_projects from authenticated;
grant insert (user_id, title, business_type, target_customer, score, status, report_json) on public.opportunity_projects to authenticated;
grant update (title, business_type, target_customer, score, status, report_json, updated_at) on public.opportunity_projects to authenticated;

create or replace function public.set_current_project_focus(
  p_project_id uuid,
  p_request_id uuid,
  p_source text default 'project_library'
) returns table(project_id uuid, previous_project_id uuid, changed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  previous_id uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null then raise exception 'Request id is required.'; end if;
  if not exists (select 1 from public.opportunity_projects p where p.id = p_project_id and p.user_id = actor and p.deleted_at is null and p.lifecycle_status = 'active') then
    raise exception 'Project is not available for focus.';
  end if;
  select f.project_id into previous_id from public.founder_project_focus f where f.user_id = actor for update;
  if previous_id = p_project_id then return query select p_project_id, previous_id, false; return; end if;
  insert into public.founder_project_focus(user_id,project_id,updated_at) values(actor,p_project_id,now())
  on conflict (user_id) do update set project_id = excluded.project_id, updated_at = excluded.updated_at;
  if previous_id is not null then
    insert into public.project_lifecycle_events(project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata)
    values(previous_id,actor,'project_unfocused','focused','active','Focus moved to another active project.',p_request_id,jsonb_build_object('source',left(coalesce(p_source,'unknown'),80))) on conflict do nothing;
  end if;
  insert into public.project_lifecycle_events(project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata)
  values(p_project_id,actor,'project_focused',case when previous_id is null then null else 'unfocused' end,'focused',null,p_request_id,jsonb_build_object('source',left(coalesce(p_source,'unknown'),80))) on conflict do nothing;
  return query select p_project_id, previous_id, true;
end $$;

create or replace function public.register_project_creation_lifecycle(p_project_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.opportunity_projects p where p.id=p_project_id and p.user_id=actor and p.deleted_at is null) then raise exception 'Project not found.'; end if;
  insert into public.project_lifecycle_events(project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata)
  values(p_project_id,actor,'project_created',null,'active',null,p_request_id,jsonb_build_object('source','create_project')) on conflict do nothing;
  insert into public.founder_project_focus(user_id,project_id,updated_at) values(actor,p_project_id,now()) on conflict(user_id) do update set project_id=excluded.project_id,updated_at=excluded.updated_at;
  return true;
end $$;

create or replace function public.transition_project_lifecycle(
  p_project_id uuid,
  p_action text,
  p_reason text,
  p_request_id uuid,
  p_expected_version integer,
  p_set_focus boolean default true,
  p_confirmation text default null
) returns table(project_id uuid, lifecycle_status text, lifecycle_version integer, deleted_at timestamptz, recovery_expires_at timestamptz, changed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  row_data public.opportunity_projects%rowtype;
  next_status text;
  event_name text;
  next_focus uuid;
  was_focus boolean := false;
  safe_reason text := nullif(left(trim(coalesce(p_reason,'')),500),'');
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null then raise exception 'Request id is required.'; end if;
  if p_action not in ('pause','resume','complete','archive','abandon','restore','soft_delete','permanent_delete') then raise exception 'Unsupported lifecycle action.'; end if;
  select * into row_data from public.opportunity_projects where id = p_project_id and user_id = actor for update;
  if not found then raise exception 'Project not found.'; end if;
  if row_data.lifecycle_version <> p_expected_version then raise exception 'Project changed in another tab. Refresh and try again.'; end if;

  if p_action = 'permanent_delete' then
    if row_data.deleted_at is null then raise exception 'Delete the project first before permanently removing it.'; end if;
    if p_confirmation is distinct from row_data.title then raise exception 'Project title confirmation does not match.'; end if;
    select exists(select 1 from public.founder_project_focus where user_id=actor and project_id=p_project_id) into was_focus;
    delete from public.founder_project_focus where user_id = actor and project_id = p_project_id;
    update public.xp_events set metadata = jsonb_build_object('deleted_project',true,'progression_category',progression_category), source_id = null where user_id = actor and project_id = p_project_id;
    delete from public.generation_history where user_id = actor and project_id = p_project_id;
    update public.feature_usage_events set metadata=jsonb_build_object('deleted_project',true),reason=null,error_category=null where user_id=actor and project_id=p_project_id;
    update public.progression_flags set metadata=jsonb_build_object('deleted_project',true),reason='Progression integrity review retained after private project deletion.' where user_id=actor and project_id=p_project_id;
    update public.project_lifecycle_events set reason = null, metadata = jsonb_build_object('deleted_project',true) where user_id = actor and project_id = p_project_id;
    insert into public.project_lifecycle_events(project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata)
    values(p_project_id,actor,'project_permanently_deleted',row_data.lifecycle_status,'deleted',null,p_request_id,jsonb_build_object('privacy_cleanup',true)) on conflict do nothing;
    insert into public.deleted_project_tombstones(project_id,user_id,permanently_deleted_at) values(p_project_id,actor,now()) on conflict(project_id) do update set permanently_deleted_at=excluded.permanently_deleted_at;
    delete from public.opportunity_projects where id = p_project_id and user_id = actor;
    if was_focus then
      select p.id into next_focus from public.opportunity_projects p where p.user_id = actor and p.deleted_at is null and p.lifecycle_status = 'active' order by p.last_meaningful_activity_at desc, p.created_at desc limit 1;
      if next_focus is not null then insert into public.founder_project_focus(user_id,project_id,updated_at) values(actor,next_focus,now()) on conflict(user_id) do update set project_id=excluded.project_id,updated_at=excluded.updated_at; end if;
    end if;
    return query select p_project_id, 'deleted'::text, row_data.lifecycle_version + 1, now(), null::timestamptz, true; return;
  end if;

  if row_data.deleted_at is not null and p_action = 'soft_delete' then return query select row_data.id,row_data.lifecycle_status,row_data.lifecycle_version,row_data.deleted_at,row_data.recovery_expires_at,false; return; end if;
  if row_data.deleted_at is not null and p_action <> 'restore' then raise exception 'This project is in recovery. Restore it before changing its lifecycle.'; end if;
  if p_action in ('pause','archive','abandon') and row_data.lifecycle_status = p_action || 'd' then
    return query select row_data.id,row_data.lifecycle_status,row_data.lifecycle_version,row_data.deleted_at,row_data.recovery_expires_at,false; return;
  end if;
  if p_action = 'complete' and row_data.lifecycle_status = 'completed' then return query select row_data.id,row_data.lifecycle_status,row_data.lifecycle_version,row_data.deleted_at,row_data.recovery_expires_at,false; return; end if;
  if p_action in ('resume','restore') and row_data.lifecycle_status = 'active' and row_data.deleted_at is null then return query select row_data.id,row_data.lifecycle_status,row_data.lifecycle_version,row_data.deleted_at,row_data.recovery_expires_at,false; return; end if;
  if p_action = 'pause' and row_data.lifecycle_status <> 'active' then raise exception 'Only an active project can be paused.'; end if;
  if p_action = 'resume' and row_data.lifecycle_status <> 'paused' then raise exception 'Only a paused project can be resumed.'; end if;
  if p_action = 'restore' and row_data.deleted_at is not null and row_data.recovery_expires_at < now() then raise exception 'The recovery window has expired.'; end if;
  if p_action in ('complete','abandon') and not exists(select 1 from public.project_closure_reflections r where r.project_id=p_project_id and r.user_id=actor) then raise exception 'Save the project closure reflection first.'; end if;
  if p_action in ('pause','abandon','restore') and safe_reason is null then raise exception 'Add a short reason for this change.'; end if;

  next_status := case p_action when 'pause' then 'paused' when 'resume' then 'active' when 'complete' then 'completed' when 'archive' then 'archived' when 'abandon' then 'abandoned' when 'restore' then 'active' when 'soft_delete' then row_data.lifecycle_status end;
  event_name := case p_action when 'pause' then 'project_paused' when 'resume' then 'project_resumed' when 'complete' then 'project_completed' when 'archive' then 'project_archived' when 'abandon' then 'project_abandoned' when 'restore' then 'project_restored' when 'soft_delete' then 'project_soft_deleted' end;

  update public.opportunity_projects set
    lifecycle_status = next_status,
    last_meaningful_activity_at = now(),
    paused_at = case when p_action='pause' then now() else paused_at end,
    resumed_at = case when p_action in ('resume','restore') then now() else resumed_at end,
    completed_at = case when p_action='complete' then now() else completed_at end,
    archived_at = case when p_action='archive' then now() else archived_at end,
    abandoned_at = case when p_action='abandon' then now() else abandoned_at end,
    deleted_at = case when p_action='soft_delete' then now() when p_action='restore' then null else deleted_at end,
    recovery_expires_at = case when p_action='soft_delete' then now()+interval '30 days' when p_action='restore' then null else recovery_expires_at end,
    lifecycle_version = lifecycle_version + 1
  where id = p_project_id and user_id = actor;

  if p_action in ('pause','complete','archive','abandon','soft_delete') then
    update public.validation_paths set status='paused',updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lifecycle_action',p_action) where project_id=p_project_id and user_id=actor and status='active';
    insert into public.validation_path_events(user_id,project_id,validation_path_id,event_type,previous_path_type,next_path_type,reason,request_id,metadata)
    select actor,p_project_id,v.id,'paused',v.path_type,v.path_type,'Project lifecycle changed to '||p_action,p_request_id,jsonb_build_object('lifecycle_action',p_action)
    from public.validation_paths v where v.project_id=p_project_id and v.user_id=actor and v.status='paused' order by v.updated_at desc limit 1 on conflict do nothing;
    select exists(select 1 from public.founder_project_focus where user_id=actor and project_id=p_project_id) into was_focus;
    delete from public.founder_project_focus where user_id=actor and project_id=p_project_id;
    if was_focus then
      select p.id into next_focus from public.opportunity_projects p where p.user_id=actor and p.id<>p_project_id and p.deleted_at is null and p.lifecycle_status='active' order by p.last_meaningful_activity_at desc,p.created_at desc limit 1;
      if next_focus is not null then insert into public.founder_project_focus(user_id,project_id,updated_at) values(actor,next_focus,now()) on conflict(user_id) do update set project_id=excluded.project_id,updated_at=excluded.updated_at; end if;
    end if;
  elsif p_action in ('resume','restore') then
    update public.validation_paths set status='active',updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lifecycle_action',p_action) where id=(select id from public.validation_paths where project_id=p_project_id and user_id=actor and status='paused' order by updated_at desc limit 1) and not exists(select 1 from public.validation_paths where project_id=p_project_id and status='active');
    insert into public.validation_path_events(user_id,project_id,validation_path_id,event_type,previous_path_type,next_path_type,reason,request_id,metadata)
    select actor,p_project_id,v.id,'activated',v.path_type,v.path_type,'Project returned to active work.',p_request_id,jsonb_build_object('lifecycle_action',p_action)
    from public.validation_paths v where v.project_id=p_project_id and v.user_id=actor and v.status='active' order by v.updated_at desc limit 1 on conflict do nothing;
    if p_set_focus then insert into public.founder_project_focus(user_id,project_id,updated_at) values(actor,p_project_id,now()) on conflict(user_id) do update set project_id=excluded.project_id,updated_at=excluded.updated_at; end if;
  end if;

  insert into public.project_lifecycle_events(project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata)
  values(p_project_id,actor,event_name,row_data.lifecycle_status,case when p_action='soft_delete' then 'deleted' else next_status end,safe_reason,p_request_id,jsonb_build_object('source','founder_action')) on conflict do nothing;
  return query select p.id,p.lifecycle_status,p.lifecycle_version,p.deleted_at,p.recovery_expires_at,true from public.opportunity_projects p where p.id=p_project_id;
end $$;

revoke all on function public.set_current_project_focus(uuid,uuid,text) from public, anon;
revoke all on function public.register_project_creation_lifecycle(uuid,uuid) from public, anon;
revoke all on function public.transition_project_lifecycle(uuid,text,text,uuid,integer,boolean,text) from public, anon;
grant execute on function public.set_current_project_focus(uuid,uuid,text) to authenticated;
grant execute on function public.register_project_creation_lifecycle(uuid,uuid) to authenticated;
grant execute on function public.transition_project_lifecycle(uuid,text,text,uuid,integer,boolean,text) to authenticated;

create or replace function public.touch_project_meaningful_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare target_project uuid;
begin
  target_project := new.project_id;
  if target_project is not null then update public.opportunity_projects set last_meaningful_activity_at=now() where id=target_project and deleted_at is null; end if;
  return new;
end $$;

create or replace function public.touch_project_fields_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.title is distinct from new.title or old.business_type is distinct from new.business_type or old.target_customer is distinct from new.target_customer or old.status is distinct from new.status or old.report_json is distinct from new.report_json then new.last_meaningful_activity_at := now(); end if;
  return new;
end $$;

drop trigger if exists opportunity_projects_meaningful_fields on public.opportunity_projects;
create trigger opportunity_projects_meaningful_fields before update on public.opportunity_projects for each row execute function public.touch_project_fields_activity();
drop trigger if exists validation_experiments_touch_project on public.project_validation_experiments;
create trigger validation_experiments_touch_project after insert or update on public.project_validation_experiments for each row execute function public.touch_project_meaningful_activity();
drop trigger if exists project_decisions_touch_project on public.project_decisions;
create trigger project_decisions_touch_project after insert on public.project_decisions for each row execute function public.touch_project_meaningful_activity();
drop trigger if exists validation_path_events_touch_project on public.validation_path_events;
create trigger validation_path_events_touch_project after insert on public.validation_path_events for each row execute function public.touch_project_meaningful_activity();
drop trigger if exists stage_history_touch_project on public.project_stage_history;
create trigger stage_history_touch_project after insert on public.project_stage_history for each row execute function public.touch_project_meaningful_activity();
drop trigger if exists closure_reflections_touch_project on public.project_closure_reflections;
create trigger closure_reflections_touch_project after insert or update on public.project_closure_reflections for each row execute function public.touch_project_meaningful_activity();
drop trigger if exists xp_events_touch_project on public.xp_events;
create trigger xp_events_touch_project after insert on public.xp_events for each row when (new.project_id is not null and new.event_status='awarded') execute function public.touch_project_meaningful_activity();

insert into public.founder_project_focus(user_id,project_id,updated_at)
select ranked.user_id,ranked.id,now() from (
  select p.user_id,p.id,row_number() over(partition by p.user_id order by p.last_meaningful_activity_at desc,p.created_at desc) as position
  from public.opportunity_projects p where p.deleted_at is null and p.lifecycle_status='active'
) ranked where ranked.position=1 and not exists(select 1 from public.founder_project_focus f where f.user_id=ranked.user_id)
on conflict(user_id) do nothing;

comment on column public.opportunity_projects.status is 'Founder journey stage: idea, validating, building, or launched. Not lifecycle status.';
comment on column public.opportunity_projects.lifecycle_status is 'Work lifecycle: active, paused, completed, archived, or abandoned.';
comment on table public.founder_project_focus is 'Exactly one current-focus project per founder when a focus exists.';
comment on table public.project_lifecycle_events is 'Append-only lifecycle history. Lifecycle actions award no XP.';

commit;
