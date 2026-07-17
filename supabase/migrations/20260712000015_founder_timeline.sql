-- PrismForge Tier 3A: canonical founder timeline and decision-history foundation.
-- Run after 20260712000014_project_lifecycle.sql.

begin;

alter table public.project_decisions
  add column if not exists previous_assumption text,
  add column if not exists new_assumption text,
  add column if not exists evidence_summary text,
  add column if not exists outcome text;

alter table public.project_decisions drop constraint if exists project_decisions_previous_assumption_length;
alter table public.project_decisions add constraint project_decisions_previous_assumption_length check (previous_assumption is null or char_length(previous_assumption) <= 1000);
alter table public.project_decisions drop constraint if exists project_decisions_new_assumption_length;
alter table public.project_decisions add constraint project_decisions_new_assumption_length check (new_assumption is null or char_length(new_assumption) <= 1000);
alter table public.project_decisions drop constraint if exists project_decisions_evidence_summary_length;
alter table public.project_decisions add constraint project_decisions_evidence_summary_length check (evidence_summary is null or char_length(evidence_summary) <= 1500);
alter table public.project_decisions drop constraint if exists project_decisions_outcome_length;
alter table public.project_decisions add constraint project_decisions_outcome_length check (outcome is null or char_length(outcome) <= 1500);

create table if not exists public.founder_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.opportunity_projects(id) on delete set null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  category text not null check (category in ('projects','validation','revenue','launch','learning','decisions','milestones')),
  headline text not null check (char_length(headline) between 3 and 180),
  description text check (description is null or char_length(description) <= 500),
  evidence_level text not null default 'none' check (evidence_level in ('none','self_reported','manual_detailed','evidence_supported','system_verified')),
  visibility text not null default 'private' check (visibility = 'private'),
  origin_system text not null check (origin_system in ('project','lifecycle','validation','proof_board','decision','progression','reflection','value_proof')),
  source_table text not null,
  source_id text not null,
  dedupe_key text not null,
  request_id uuid,
  decision_id uuid references public.project_decisions(id) on delete set null,
  proof_experiment_id uuid references public.project_validation_experiments(id) on delete set null,
  lifecycle_event_id uuid references public.project_lifecycle_events(id) on delete set null,
  xp_event_id uuid references public.xp_events(id) on delete set null,
  validation_path_id uuid references public.validation_paths(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (to_tsvector('english', coalesce(headline,'') || ' ' || coalesce(description,''))) stored,
  unique (user_id, dedupe_key)
);

create index if not exists founder_timeline_user_created_idx on public.founder_timeline_events(user_id, created_at desc, id desc);
create index if not exists founder_timeline_project_created_idx on public.founder_timeline_events(project_id, created_at desc, id desc) where project_id is not null;
create index if not exists founder_timeline_user_category_idx on public.founder_timeline_events(user_id, category, created_at desc, id desc);
create index if not exists founder_timeline_search_idx on public.founder_timeline_events using gin(search_document);
create index if not exists founder_timeline_decision_idx on public.founder_timeline_events(decision_id) where decision_id is not null;
create index if not exists founder_timeline_proof_idx on public.founder_timeline_events(proof_experiment_id) where proof_experiment_id is not null;

alter table public.founder_timeline_events enable row level security;
drop policy if exists "Founders read their own timeline" on public.founder_timeline_events;
create policy "Founders read their own timeline" on public.founder_timeline_events for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

revoke all on public.founder_timeline_events from anon, authenticated;
grant select on public.founder_timeline_events to authenticated;
grant all on public.founder_timeline_events to service_role;

create or replace function public.emit_founder_timeline_event(
  p_user_id uuid,
  p_project_id uuid,
  p_event_type text,
  p_category text,
  p_headline text,
  p_description text,
  p_evidence_level text,
  p_origin_system text,
  p_source_table text,
  p_source_id text,
  p_dedupe_key text,
  p_request_id uuid default null,
  p_decision_id uuid default null,
  p_proof_experiment_id uuid default null,
  p_lifecycle_event_id uuid default null,
  p_xp_event_id uuid default null,
  p_validation_path_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare emitted_id uuid;
begin
  if p_user_id is null or p_dedupe_key is null or length(p_dedupe_key) > 240 then return null; end if;
  insert into public.founder_timeline_events(
    user_id,project_id,event_type,category,headline,description,evidence_level,origin_system,
    source_table,source_id,dedupe_key,request_id,decision_id,proof_experiment_id,
    lifecycle_event_id,xp_event_id,validation_path_id,metadata,created_at
  ) values (
    p_user_id,p_project_id,p_event_type,p_category,left(p_headline,180),nullif(left(coalesce(p_description,''),500),''),
    p_evidence_level,p_origin_system,left(p_source_table,80),left(p_source_id,160),left(p_dedupe_key,240),
    p_request_id,p_decision_id,p_proof_experiment_id,p_lifecycle_event_id,p_xp_event_id,p_validation_path_id,
    case when pg_column_size(coalesce(p_metadata,'{}'::jsonb)) <= 4096 then coalesce(p_metadata,'{}'::jsonb) else '{}'::jsonb end,
    coalesce(p_created_at,now())
  ) on conflict (user_id,dedupe_key) do nothing returning id into emitted_id;
  return emitted_id;
end $$;
revoke all on function public.emit_founder_timeline_event(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.emit_founder_timeline_event(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,timestamptz) to service_role;

create or replace function public.timeline_from_lifecycle_event() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare label text; category_name text := 'projects';
begin
  if new.event_type not in ('project_created','project_paused','project_resumed','project_completed','project_archived','project_abandoned','project_restored') then return new; end if;
  label := case new.event_type
    when 'project_created' then 'Project created'
    when 'project_paused' then 'Project paused'
    when 'project_resumed' then 'Project resumed'
    when 'project_completed' then 'Project completed'
    when 'project_archived' then 'Project archived'
    when 'project_abandoned' then 'Project stopped'
    when 'project_restored' then 'Project restored' end;
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,new.event_type,category_name,label,new.reason,'system_verified','lifecycle','project_lifecycle_events',new.id::text,'project:'||coalesce(new.project_id::text,new.id::text)||':'||new.event_type,new.request_id,null,null,new.id,null,null,jsonb_build_object('previous_status',new.previous_status,'next_status',new.next_status),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_stage_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,
    case when new.new_stage='launched' then 'beta_launched' when new.new_stage='validating' then 'validation_started' else 'project_stage_changed' end,
    case when new.new_stage='launched' then 'launch' when new.new_stage='validating' then 'validation' else 'projects' end,
    case when new.new_stage='launched' then 'Beta launched' when new.new_stage='validating' then 'Started validation' else 'Project moved to '||initcap(new.new_stage) end,
    new.reason,'system_verified','project','project_stage_history',new.id::text,'stage:'||new.id::text,new.request_id,null,null,null,null,null,
    jsonb_build_object('previous_stage',new.previous_stage,'new_stage',new.new_stage,'suggested_stage',new.suggested_stage,'conflict',new.conflict),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_decision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare event_name text; title_text text;
begin
  event_name := case new.decision_type when 'narrow_audience' then 'audience_changed' when 'test_another_segment' then 'audience_changed' when 'revise_problem' then 'problem_changed' when 'revise_solution' then 'major_pivot' when 'abandon' then 'decision_to_stop' else 'decision_made' end;
  title_text := case new.decision_type when 'narrow_audience' then 'Changed the target audience' when 'test_another_segment' then 'Changed the target audience' when 'revise_problem' then 'Changed the problem assumption' when 'revise_solution' then 'Pivoted the solution' when 'test_pricing' then 'Decided to test pricing' when 'build_prototype' then 'Decided to build a prototype' when 'launch' then 'Decided to prepare for launch' when 'pause' then 'Decided to pause' when 'abandon' then 'Decided to stop the project' else 'Founder decision recorded' end;
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,event_name,'decisions',title_text,null,
    case when new.evidence_summary is not null or new.experiment_id is not null then 'evidence_supported' else 'manual_detailed' end,
    'decision','project_decisions',new.id::text,'decision:'||new.id::text,new.request_id,new.id,new.experiment_id,null,null,new.validation_path_id,
    jsonb_build_object('decision_type',new.decision_type),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_validation_path_event() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.event_type not in ('activated','completed','alternative_selected') then return new; end if;
  -- Initial system routing occurs while rendering a new project. It is setup, not founder progress.
  if new.event_type='activated' and new.previous_path_type is null and exists(select 1 from public.validation_paths p where p.id=new.validation_path_id and p.source='system') then return new; end if;
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,
    case new.event_type when 'activated' then 'validation_started' when 'completed' then 'validation_path_completed' else 'validation_direction_changed' end,
    'validation',case new.event_type when 'activated' then 'Started validation' when 'completed' then 'Completed a validation path' else 'Changed validation direction' end,
    new.reason,'system_verified','validation','validation_path_events',new.id::text,'validation-path-event:'||new.id::text,new.request_id,null,null,null,null,new.validation_path_id,
    jsonb_build_object('previous_path',new.previous_path_type,'next_path',new.next_path_type),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_proof_experiment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then
    perform public.emit_founder_timeline_event(new.user_id,new.project_id,'experiment_completed','validation','Experiment completed',null,
      case when coalesce(length(new.learnings),0)>=12 then 'evidence_supported' else 'self_reported' end,
      'proof_board','project_validation_experiments',new.id::text,'proof:'||new.id::text||':completed',new.request_id,null,new.id,null,null,new.validation_path_id,
      jsonb_build_object('evidence_type',new.evidence_type),new.updated_at);
  end if;
  return new;
end $$;

create or replace function public.timeline_from_xp_event() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare category_name text; event_name text; title_text text;
begin
  if new.event_status <> 'awarded' or new.awarded_xp <= 0 or new.progression_category in ('legacy','adjustment','project_structure') then return new; end if;
  category_name := case new.progression_category when 'revenue' then 'revenue' when 'launch' then 'launch' when 'learning' then 'learning' when 'decision' then 'decisions' when 'evidence' then 'validation' when 'experiment' then 'validation' else 'milestones' end;
  event_name := case new.action when 'first_revenue' then 'first_payment' when 'first_waitlist_signal' then 'first_waitlist_signup' when 'first_pain_confirmation' then 'pain_confirmed' else new.action end;
  title_text := regexp_replace(initcap(replace(event_name,'_',' ')),'\s+',' ','g');
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,event_name,category_name,title_text,null,new.verification_level,
    case when new.source_type='milestone' then 'value_proof' else 'progression' end,'xp_events',new.id::text,'xp:'||new.id::text,null,null,null,null,new.id,null,
    jsonb_build_object('progression_category',new.progression_category),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_closure_reflection() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.emit_founder_timeline_event(new.user_id,new.project_id,'closure_reflection_recorded','learning','Biggest project lesson recorded',null,'manual_detailed',
    'reflection','project_closure_reflections',new.id::text,'reflection:'||new.id::text,null,null,null,null,null,null,jsonb_build_object('outcome',new.outcome),new.created_at);
  return new;
end $$;

create or replace function public.timeline_from_level_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op='UPDATE' and new.level > old.level then
    perform public.emit_founder_timeline_event(new.user_id,null,'founder_level_up','milestones','Reached founder level '||new.level,null,'system_verified',
      'progression','user_xp',new.user_id::text,'level:'||new.user_id::text||':'||new.level,null,null,null,null,null,null,jsonb_build_object('level',new.level,'title',new.title),new.updated_at);
  end if;
  return new;
end $$;

drop trigger if exists founder_timeline_lifecycle on public.project_lifecycle_events;
create trigger founder_timeline_lifecycle after insert on public.project_lifecycle_events for each row execute function public.timeline_from_lifecycle_event();
drop trigger if exists founder_timeline_stage on public.project_stage_history;
create trigger founder_timeline_stage after insert on public.project_stage_history for each row execute function public.timeline_from_stage_history();
drop trigger if exists founder_timeline_decision on public.project_decisions;
create trigger founder_timeline_decision after insert on public.project_decisions for each row execute function public.timeline_from_decision();
drop trigger if exists founder_timeline_validation_path on public.validation_path_events;
create trigger founder_timeline_validation_path after insert on public.validation_path_events for each row execute function public.timeline_from_validation_path_event();
drop trigger if exists founder_timeline_proof on public.project_validation_experiments;
create trigger founder_timeline_proof after insert or update of status on public.project_validation_experiments for each row execute function public.timeline_from_proof_experiment();
drop trigger if exists founder_timeline_xp on public.xp_events;
create trigger founder_timeline_xp after insert on public.xp_events for each row execute function public.timeline_from_xp_event();
drop trigger if exists founder_timeline_reflection on public.project_closure_reflections;
create trigger founder_timeline_reflection after insert on public.project_closure_reflections for each row execute function public.timeline_from_closure_reflection();
drop trigger if exists founder_timeline_level on public.user_xp;
create trigger founder_timeline_level after update of level on public.user_xp for each row execute function public.timeline_from_level_change();

-- Preserve founder progress while removing private project content during permanent deletion.
create or replace function public.sanitize_deleted_project_timeline() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.founder_timeline_events set project_id=null,description=null,headline='Deleted project milestone',metadata=jsonb_build_object('deleted_project',true),decision_id=null,proof_experiment_id=null,lifecycle_event_id=null,validation_path_id=null
  where project_id=old.id and user_id=old.user_id;
  return old;
end $$;
drop trigger if exists sanitize_timeline_before_project_delete on public.opportunity_projects;
create trigger sanitize_timeline_before_project_delete before delete on public.opportunity_projects for each row execute function public.sanitize_deleted_project_timeline();

-- Backfill meaningful history. Stable dedupe keys make this migration safely repeatable.
insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,evidence_level,origin_system,source_table,source_id,dedupe_key,created_at)
select p.user_id,p.id,'project_created','projects','Project created','system_verified','project','opportunity_projects',p.id::text,'project:'||p.id::text||':project_created',p.created_at
from public.opportunity_projects p on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,description,evidence_level,origin_system,source_table,source_id,dedupe_key,request_id,lifecycle_event_id,metadata,created_at)
select e.user_id,e.project_id,e.event_type,'projects',case e.event_type when 'project_paused' then 'Project paused' when 'project_resumed' then 'Project resumed' when 'project_completed' then 'Project completed' when 'project_archived' then 'Project archived' when 'project_abandoned' then 'Project stopped' when 'project_restored' then 'Project restored' end,e.reason,'system_verified','lifecycle','project_lifecycle_events',e.id::text,'project:'||coalesce(e.project_id::text,e.id::text)||':'||e.event_type,e.request_id,e.id,jsonb_build_object('previous_status',e.previous_status,'next_status',e.next_status),e.created_at
from public.project_lifecycle_events e where e.event_type in ('project_paused','project_resumed','project_completed','project_archived','project_abandoned','project_restored') on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,evidence_level,origin_system,source_table,source_id,dedupe_key,request_id,decision_id,proof_experiment_id,validation_path_id,metadata,created_at)
select d.user_id,d.project_id,case d.decision_type when 'narrow_audience' then 'audience_changed' when 'test_another_segment' then 'audience_changed' when 'revise_problem' then 'problem_changed' when 'revise_solution' then 'major_pivot' else 'decision_made' end,'decisions','Founder decision recorded',case when d.experiment_id is not null then 'evidence_supported' else 'manual_detailed' end,'decision','project_decisions',d.id::text,'decision:'||d.id::text,d.request_id,d.id,d.experiment_id,d.validation_path_id,jsonb_build_object('decision_type',d.decision_type),d.created_at
from public.project_decisions d on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,description,evidence_level,origin_system,source_table,source_id,dedupe_key,request_id,metadata,created_at)
select s.user_id,s.project_id,case when s.new_stage='launched' then 'beta_launched' when s.new_stage='validating' then 'validation_started' else 'project_stage_changed' end,
case when s.new_stage='launched' then 'launch' when s.new_stage='validating' then 'validation' else 'projects' end,
case when s.new_stage='launched' then 'Beta launched' when s.new_stage='validating' then 'Started validation' else 'Project moved to '||initcap(s.new_stage) end,
s.reason,'system_verified','project','project_stage_history',s.id::text,'stage:'||s.id::text,s.request_id,
jsonb_build_object('previous_stage',s.previous_stage,'new_stage',s.new_stage,'suggested_stage',s.suggested_stage,'conflict',s.conflict),s.created_at
from public.project_stage_history s on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,description,evidence_level,origin_system,source_table,source_id,dedupe_key,request_id,validation_path_id,metadata,created_at)
select v.user_id,v.project_id,case when v.event_type='completed' then 'validation_path_completed' else 'validation_direction_changed' end,'validation',
case when v.event_type='completed' then 'Completed a validation path' else 'Changed validation direction' end,v.reason,'system_verified','validation','validation_path_events',v.id::text,'validation-path-event:'||v.id::text,v.request_id,v.validation_path_id,
jsonb_build_object('previous_path',v.previous_path_type,'next_path',v.next_path_type),v.created_at
from public.validation_path_events v where v.event_type in ('completed','alternative_selected') on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,evidence_level,origin_system,source_table,source_id,dedupe_key,request_id,proof_experiment_id,validation_path_id,metadata,created_at)
select p.user_id,p.project_id,'experiment_completed','validation','Experiment completed',case when coalesce(length(p.learnings),0)>=12 then 'evidence_supported' else 'self_reported' end,
'proof_board','project_validation_experiments',p.id::text,'proof:'||p.id::text||':completed',p.request_id,p.id,p.validation_path_id,jsonb_build_object('evidence_type',p.evidence_type),p.updated_at
from public.project_validation_experiments p where p.status='completed' on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,evidence_level,origin_system,source_table,source_id,dedupe_key,metadata,created_at)
select r.user_id,r.project_id,'closure_reflection_recorded','learning','Biggest project lesson recorded','manual_detailed','reflection','project_closure_reflections',r.id::text,'reflection:'||r.id::text,jsonb_build_object('outcome',r.outcome),r.created_at
from public.project_closure_reflections r on conflict(user_id,dedupe_key) do nothing;

insert into public.founder_timeline_events(user_id,project_id,event_type,category,headline,evidence_level,origin_system,source_table,source_id,dedupe_key,xp_event_id,metadata,created_at)
select x.user_id,x.project_id,case x.action when 'first_revenue' then 'first_payment' when 'first_waitlist_signal' then 'first_waitlist_signup' when 'first_pain_confirmation' then 'pain_confirmed' else x.action end,
case x.progression_category when 'revenue' then 'revenue' when 'launch' then 'launch' when 'learning' then 'learning' when 'decision' then 'decisions' when 'evidence' then 'validation' when 'experiment' then 'validation' else 'milestones' end,
regexp_replace(initcap(replace(case x.action when 'first_revenue' then 'first_payment' when 'first_waitlist_signal' then 'first_waitlist_signup' when 'first_pain_confirmation' then 'pain_confirmed' else x.action end,'_',' ')),'\s+',' ','g'),x.verification_level,
case when x.source_type='milestone' then 'value_proof' else 'progression' end,'xp_events',x.id::text,'xp:'||x.id::text,x.id,jsonb_build_object('progression_category',x.progression_category),x.created_at
from public.xp_events x where x.event_status='awarded' and x.awarded_xp>0 and x.progression_category not in ('legacy','adjustment','project_structure') on conflict(user_id,dedupe_key) do nothing;

create or replace function public.search_founder_timeline(
  p_project_id uuid default null,
  p_category text default null,
  p_query text default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 21
) returns table(
  id uuid,user_id uuid,project_id uuid,event_type text,category text,headline text,description text,
  evidence_level text,origin_system text,request_id uuid,decision_id uuid,proof_experiment_id uuid,
  lifecycle_event_id uuid,xp_event_id uuid,validation_path_id uuid,metadata jsonb,created_at timestamptz,
  project_title text,decision_type text,previous_assumption text,new_assumption text,decision_reason text,
  decision_evidence text,decision_outcome text,proof_title text,proof_learnings text,xp_reason text,awarded_xp integer
)
language sql stable security invoker set search_path = public, pg_temp as $$
  select e.id,e.user_id,e.project_id,e.event_type,e.category,e.headline,e.description,e.evidence_level,e.origin_system,
    e.request_id,e.decision_id,e.proof_experiment_id,e.lifecycle_event_id,e.xp_event_id,e.validation_path_id,e.metadata,e.created_at,
    p.title,d.decision_type,d.previous_assumption,d.new_assumption,d.rationale,d.evidence_summary,d.outcome,
    proof.title,proof.learnings,x.reason,x.awarded_xp
  from public.founder_timeline_events e
  left join public.opportunity_projects p on p.id=e.project_id and p.user_id=e.user_id
  left join public.project_decisions d on d.id=e.decision_id and d.user_id=e.user_id
  left join public.project_validation_experiments proof on proof.id=e.proof_experiment_id and proof.user_id=e.user_id
  left join public.xp_events x on x.id=e.xp_event_id and x.user_id=e.user_id
  where e.user_id=(select auth.uid())
    and (p_project_id is null or e.project_id=p_project_id)
    and (p_category is null or e.category=p_category)
    and (p_before_created_at is null or (e.created_at,e.id) < (p_before_created_at,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    and (
      nullif(trim(coalesce(p_query,'')),'') is null
      or e.search_document @@ websearch_to_tsquery('english',left(trim(p_query),120))
      or strpos(lower(coalesce(p.title,'')),lower(left(trim(p_query),120)))>0
      or strpos(lower(coalesce(d.rationale,'')),lower(left(trim(p_query),120)))>0
      or strpos(lower(coalesce(d.previous_assumption,'')),lower(left(trim(p_query),120)))>0
      or strpos(lower(coalesce(d.new_assumption,'')),lower(left(trim(p_query),120)))>0
    )
  order by e.created_at desc,e.id desc
  limit least(greatest(p_limit,1),51)
$$;
revoke all on function public.search_founder_timeline(uuid,text,text,timestamptz,uuid,integer) from public, anon;
grant execute on function public.search_founder_timeline(uuid,text,text,timestamptz,uuid,integer) to authenticated, service_role;

revoke all on function public.timeline_from_lifecycle_event() from public, anon, authenticated;
revoke all on function public.timeline_from_stage_history() from public, anon, authenticated;
revoke all on function public.timeline_from_decision() from public, anon, authenticated;
revoke all on function public.timeline_from_validation_path_event() from public, anon, authenticated;
revoke all on function public.timeline_from_proof_experiment() from public, anon, authenticated;
revoke all on function public.timeline_from_xp_event() from public, anon, authenticated;
revoke all on function public.timeline_from_closure_reflection() from public, anon, authenticated;
revoke all on function public.timeline_from_level_change() from public, anon, authenticated;
revoke all on function public.sanitize_deleted_project_timeline() from public, anon, authenticated;

comment on table public.founder_timeline_events is 'Canonical, append-only record of meaningful founder progress. Never use for clicks, page views, AI prompts, or audit logs.';

commit;
