-- PrismForge RLS performance and RPC exposure hardening.
-- Preserves access semantics while caching auth checks per statement.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.register_project_creation_lifecycle(
  p_project_id uuid,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if not exists (
    select 1 from public.opportunity_projects project
    where project.id = p_project_id
      and project.user_id = actor
      and project.deleted_at is null
  ) then
    raise exception 'Project not found.';
  end if;

  insert into public.project_lifecycle_events(
    project_id,user_id,event_type,previous_status,next_status,reason,request_id,metadata
  )
  values(
    p_project_id,actor,'project_created',null,'active',null,p_request_id,
    jsonb_build_object('source','create_project')
  )
  on conflict do nothing;

  insert into public.founder_project_focus(user_id,project_id,updated_at)
  values(actor,p_project_id,now())
  on conflict(user_id) do update
    set project_id=excluded.project_id,updated_at=excluded.updated_at;

  return true;
end
$$;

revoke all on function private.register_project_creation_lifecycle(uuid,uuid)
  from public, anon, authenticated;
grant execute on function private.register_project_creation_lifecycle(uuid,uuid)
  to authenticated;

-- Keep the legacy public helper for old deployments, but remove ordinary API access.
revoke all on function public.register_project_creation_lifecycle(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.register_project_creation_lifecycle(uuid,uuid)
  to service_role;

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
  if actor is null then raise exception 'Authenticated user required.'; end if;
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
  if project_id is not null then return project_id; end if;

  insert into public.opportunity_projects(
    user_id,title,business_type,target_customer,score,report_json
  )
  values(actor,p_title,p_business_type,p_target_customer,p_score,p_report_json)
  returning id into project_id;

  insert into public.generation_history(
    user_id,request_id,project_id,input_json,output_json
  )
  values(actor,p_request_id,project_id,p_input_json,p_report_json);

  perform private.register_project_creation_lifecycle(project_id,request_uuid);
  return project_id;
exception
  when unique_violation then
    select history.project_id
      into project_id
      from public.generation_history history
      where history.user_id=actor
        and history.request_id=p_request_id
        and history.project_id is not null
      limit 1;
    if project_id is not null then return project_id; end if;
    raise;
end
$$;

revoke all on function public.create_founder_project_atomic(text,text,text,text,integer,jsonb,jsonb)
  from public, anon;
grant execute on function public.create_founder_project_atomic(text,text,text,text,integer,jsonb,jsonb)
  to authenticated;
revoke all on function public.enforce_project_owner(), public.enforce_validation_links()
  from public, anon, authenticated;

alter policy "Users can read their own profile" on public.profiles
  using (id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can update their own profile" on public.profiles
  using (id=(select auth.uid()) or (select public.is_admin()))
  with check (id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can read their own subscription" on public.subscriptions
  using (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can read their xp" on public.user_xp
  using (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can read their xp history" on public.xp_events
  using (user_id=(select auth.uid()) or (select public.is_admin()));

alter policy "Users can create their own founder projects" on public.opportunity_projects
  with check (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can read their own founder projects" on public.opportunity_projects
  using (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can update their own founder projects" on public.opportunity_projects
  using (user_id=(select auth.uid()) or (select public.is_admin()))
  with check (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can delete their own founder projects" on public.opportunity_projects
  using (user_id=(select auth.uid()) or (select public.is_admin()));

alter policy "Users can create their own generation history" on public.generation_history
  with check (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can read their own generation history" on public.generation_history
  using (user_id=(select auth.uid()) or (select public.is_admin()));

alter policy "Users can create their own project outputs" on public.project_outputs
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "Users can read their own project outputs" on public.project_outputs
  using (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can update their own project outputs" on public.project_outputs
  using (user_id=(select auth.uid()) or (select public.is_admin()))
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "Users can delete their own project outputs" on public.project_outputs
  using (user_id=(select auth.uid()) or (select public.is_admin()));

alter policy "Users can create their own validation experiments" on public.project_validation_experiments
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "Users can read their own validation experiments" on public.project_validation_experiments
  using (user_id=(select auth.uid()) or (select public.is_admin()));
alter policy "Users can update their own validation experiments" on public.project_validation_experiments
  using (user_id=(select auth.uid()) or (select public.is_admin()))
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "Users can delete their own validation experiments" on public.project_validation_experiments
  using (user_id=(select auth.uid()) or (select public.is_admin()));

alter policy "founders manage own assumptions" on public.project_assumptions
  using (user_id=(select auth.uid()))
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "founders manage own validation paths" on public.validation_paths
  using (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  )
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "founders append own validation path events" on public.validation_path_events
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "founders read own validation path events" on public.validation_path_events
  using (user_id=(select auth.uid()));
alter policy "founders append own decisions" on public.project_decisions
  with check (
    user_id=(select auth.uid())
    and exists(select 1 from public.opportunity_projects p where p.id=project_id and p.user_id=(select auth.uid()))
  );
alter policy "founders read own decisions" on public.project_decisions
  using (user_id=(select auth.uid()));

drop policy if exists "Admins can read all feature usage events" on public.feature_usage_events;
drop policy if exists "Users can read their own feature usage events" on public.feature_usage_events;
create policy "Users and admins read permitted feature usage events"
on public.feature_usage_events for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_admin()));

commit;
