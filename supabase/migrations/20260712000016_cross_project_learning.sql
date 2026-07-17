-- PrismForge Tier 3B: deterministic, source-backed cross-project learning.
-- Run after 20260712000015_founder_timeline.sql.

begin;

alter table public.opportunity_projects
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists learning_excluded_at timestamptz,
  add column if not exists learning_exclusion_reason text;
alter table public.opportunity_projects drop constraint if exists opportunity_projects_learning_exclusion_reason_length;
alter table public.opportunity_projects add constraint opportunity_projects_learning_exclusion_reason_length check (learning_exclusion_reason is null or char_length(learning_exclusion_reason)<=500);

create table if not exists public.founder_learning_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  dirty_at timestamptz not null default now(),
  calculated_at timestamptz,
  data_through timestamptz,
  calculation_started_at timestamptz,
  calculation_request_id uuid,
  calculation_version integer not null default 1,
  last_error_category text,
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_project_learning_snapshots (
  project_id uuid primary key references public.opportunity_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  eligibility_status text not null default 'ineligible' check (eligibility_status in ('fully_eligible','partially_eligible','ineligible')),
  eligibility_reason text not null default 'Awaiting deterministic calculation.',
  project_type text,
  lifecycle_outcome text,
  stage_reached text,
  hours_per_week numeric,
  budget_amount numeric,
  budget_band text,
  risk_tolerance integer,
  technical_ability text,
  validation_methods text[] not null default '{}',
  evidence_types text[] not null default '{}',
  meaningful_decision_count integer not null default 0,
  experiment_count integer not null default 0,
  customer_conversation_count integer not null default 0,
  waitlist_signal_count integer not null default 0,
  payment_intent_count integer not null default 0,
  revenue_evidence_count integer not null default 0,
  time_to_first_evidence_days numeric,
  time_in_stages jsonb not null default '{}'::jsonb,
  blocker_categories text[] not null default '{}',
  assumption_summary jsonb not null default '{}'::jsonb,
  decision_types text[] not null default '{}',
  closure_reflection_ids uuid[] not null default '{}',
  limitations text[] not null default '{}',
  source_updated_at timestamptz not null default now(),
  calculated_at timestamptz not null default now(),
  unique(user_id,project_id)
);

create table if not exists public.founder_pattern_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  insight_key text not null,
  category text not null check (category in ('validation','stage','blocker','assumption','decision','constraint','project_type','outcome','lesson')),
  headline text not null check (char_length(headline) between 8 and 220),
  explanation text not null check (char_length(explanation) between 12 and 1200),
  evidence_tier text not null check (evidence_tier in ('early_indication','repeated_pattern','strong_personal_pattern')),
  supporting_project_count integer not null check (supporting_project_count>=1),
  contradicting_project_count integer not null default 0 check (contradicting_project_count>=0),
  limitations text[] not null default '{}',
  dimensions jsonb not null default '{}'::jsonb check (pg_column_size(dimensions)<=4096),
  evidence_fingerprint text not null,
  status text not null default 'active' check (status in ('pending','active','dismissed','corrected','superseded')),
  calculation_request_id uuid,
  generated_at timestamptz not null default now(),
  data_through timestamptz not null,
  search_document tsvector generated always as (to_tsvector('english',coalesce(headline,'')||' '||coalesce(explanation,''))) stored,
  unique(user_id,insight_key,evidence_fingerprint)
);
create unique index if not exists founder_pattern_one_active_key_idx on public.founder_pattern_insights(user_id,insight_key) where status='active';
create index if not exists founder_pattern_user_status_idx on public.founder_pattern_insights(user_id,status,generated_at desc,id desc);
create index if not exists founder_pattern_user_category_idx on public.founder_pattern_insights(user_id,category,status,generated_at desc);
create index if not exists founder_pattern_search_idx on public.founder_pattern_insights using gin(search_document);
create index if not exists founder_learning_snapshot_eligibility_idx on public.founder_project_learning_snapshots(user_id,eligibility_status,calculated_at desc);
create index if not exists founder_learning_snapshot_type_idx on public.founder_project_learning_snapshots(user_id,project_type,eligibility_status);

create table if not exists public.founder_pattern_insight_sources (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.founder_pattern_insights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  source_role text not null check (source_role in ('supporting','contradicting')),
  source_kind text not null check (source_kind in ('project','timeline_event','decision','experiment','reflection','assumption','validation_path')),
  source_id text not null,
  timeline_event_id uuid references public.founder_timeline_events(id) on delete set null,
  decision_id uuid references public.project_decisions(id) on delete set null,
  experiment_id uuid references public.project_validation_experiments(id) on delete set null,
  reflection_id uuid references public.project_closure_reflections(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(insight_id,project_id,source_role,source_kind,source_id)
);
create index if not exists founder_pattern_sources_insight_idx on public.founder_pattern_insight_sources(insight_id,source_role,project_id);
create index if not exists founder_pattern_sources_project_idx on public.founder_pattern_insight_sources(user_id,project_id,created_at desc);

create table if not exists public.founder_pattern_feedback (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.founder_pattern_insights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('useful','dismiss','correct','exclude_project','incomplete_data','circumstances_changed')),
  reason text,
  excluded_project_id uuid references public.opportunity_projects(id) on delete set null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
create index if not exists founder_pattern_feedback_insight_idx on public.founder_pattern_feedback(insight_id,created_at desc);
create index if not exists founder_pattern_feedback_exclusion_idx on public.founder_pattern_feedback(user_id,excluded_project_id) where feedback_type='exclude_project' and excluded_project_id is not null;

alter table public.founder_learning_state enable row level security;
alter table public.founder_project_learning_snapshots enable row level security;
alter table public.founder_pattern_insights enable row level security;
alter table public.founder_pattern_insight_sources enable row level security;
alter table public.founder_pattern_feedback enable row level security;

drop policy if exists "Founders read own learning state" on public.founder_learning_state;
create policy "Founders read own learning state" on public.founder_learning_state for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
drop policy if exists "Founders read own project learning snapshots" on public.founder_project_learning_snapshots;
create policy "Founders read own project learning snapshots" on public.founder_project_learning_snapshots for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
drop policy if exists "Founders read own pattern insights" on public.founder_pattern_insights;
create policy "Founders read own pattern insights" on public.founder_pattern_insights for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
drop policy if exists "Founders read own pattern sources" on public.founder_pattern_insight_sources;
create policy "Founders read own pattern sources" on public.founder_pattern_insight_sources for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
drop policy if exists "Founders read own pattern feedback" on public.founder_pattern_feedback;
create policy "Founders read own pattern feedback" on public.founder_pattern_feedback for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());

revoke all on public.founder_learning_state,public.founder_project_learning_snapshots,public.founder_pattern_insights,public.founder_pattern_insight_sources,public.founder_pattern_feedback from anon,authenticated;
grant select on public.founder_learning_state,public.founder_project_learning_snapshots,public.founder_pattern_insights,public.founder_pattern_insight_sources,public.founder_pattern_feedback to authenticated;
grant all on public.founder_learning_state,public.founder_project_learning_snapshots,public.founder_pattern_insights,public.founder_pattern_insight_sources,public.founder_pattern_feedback to service_role;

create or replace function public.search_founder_patterns(p_category text default null,p_query text default null,p_offset integer default 0,p_limit integer default 12)
returns table(id uuid,insight_key text,category text,headline text,explanation text,evidence_tier text,supporting_project_count integer,contradicting_project_count integer,limitations text[],dimensions jsonb,generated_at timestamptz,data_through timestamptz,total_count bigint)
language sql stable security invoker set search_path=public,pg_temp as $$
  select i.id,i.insight_key,i.category,i.headline,i.explanation,i.evidence_tier,i.supporting_project_count,i.contradicting_project_count,i.limitations,i.dimensions,i.generated_at,i.data_through,count(*) over()
  from public.founder_pattern_insights i
  where i.user_id=(select auth.uid()) and i.status='active'
    and (p_category is null or i.category=p_category)
    and (nullif(trim(coalesce(p_query,'')),'') is null
      or i.search_document @@ websearch_to_tsquery('english',left(trim(p_query),120))
      or exists(select 1 from public.founder_pattern_insight_sources s join public.opportunity_projects p on p.id=s.project_id and p.user_id=s.user_id where s.insight_id=i.id and s.user_id=i.user_id and strpos(lower(p.title),lower(left(trim(p_query),120)))>0))
  order by i.generated_at desc,i.id desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),50)
$$;
revoke all on function public.search_founder_patterns(text,text,integer,integer) from public,anon;
grant execute on function public.search_founder_patterns(text,text,integer,integer) to authenticated,service_role;

create or replace function public.learning_json_number(p_json jsonb,p_path text[]) returns numeric
language sql immutable set search_path=public,pg_temp as $$
  select case when p_json#>>p_path ~ '^-?[0-9]+(\.[0-9]+)?$' then (p_json#>>p_path)::numeric else null end
$$;

create or replace function public.seed_project_learning_context() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare skills text:=lower(coalesce(new.report_json#>>'{input,skills}','')); budget numeric:=public.learning_json_number(new.report_json,array['input','budget']);
begin
  insert into public.founder_project_learning_snapshots(project_id,user_id,project_type,hours_per_week,budget_amount,budget_band,risk_tolerance,technical_ability,source_updated_at,calculated_at)
  values(new.id,new.user_id,new.business_type,public.learning_json_number(new.report_json,array['input','timePerWeek']),budget,
    case when budget is null then null when budget<=50 then 'under_50' when budget<=250 then '51_to_250' when budget<=1000 then '251_to_1000' else 'over_1000' end,
    public.learning_json_number(new.report_json,array['input','riskTolerance'])::integer,
    case when skills ~ '(cod|program|develop|engineer|technical)' then 'recorded_technical_skill' else 'technical_skill_not_recorded' end,new.updated_at,now())
  on conflict(project_id) do update set user_id=excluded.user_id,project_type=excluded.project_type,hours_per_week=excluded.hours_per_week,budget_amount=excluded.budget_amount,budget_band=excluded.budget_band,risk_tolerance=excluded.risk_tolerance,technical_ability=excluded.technical_ability,source_updated_at=excluded.source_updated_at;
  return new;
end $$;

create or replace function public.mark_founder_learning_dirty() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;
begin
  actor:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  insert into public.founder_learning_state(user_id,dirty_at,updated_at) values(actor,now(),now())
  on conflict(user_id) do update set dirty_at=excluded.dirty_at,updated_at=excluded.updated_at;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists seed_project_learning_context_trigger on public.opportunity_projects;
create trigger seed_project_learning_context_trigger after insert or update of report_json,business_type on public.opportunity_projects for each row execute function public.seed_project_learning_context();
drop trigger if exists dirty_learning_projects on public.opportunity_projects;
create trigger dirty_learning_projects after insert or update of status,lifecycle_status,deleted_at,learning_excluded_at,is_synthetic,last_meaningful_activity_at on public.opportunity_projects for each row execute function public.mark_founder_learning_dirty();

create or replace function public.invalidate_excluded_project_learning() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (new.deleted_at is not null or new.learning_excluded_at is not null or new.is_synthetic) and
     (old.deleted_at is distinct from new.deleted_at or old.learning_excluded_at is distinct from new.learning_excluded_at or old.is_synthetic is distinct from new.is_synthetic) then
    update public.founder_pattern_insights i set status='superseded' where i.user_id=new.user_id and i.status='active' and exists(select 1 from public.founder_pattern_insight_sources s where s.insight_id=i.id and s.project_id=new.id);
  end if;
  return new;
end $$;
drop trigger if exists invalidate_learning_after_project_exclusion on public.opportunity_projects;
create trigger invalidate_learning_after_project_exclusion after update of deleted_at,learning_excluded_at,is_synthetic on public.opportunity_projects for each row execute function public.invalidate_excluded_project_learning();
drop trigger if exists dirty_learning_experiments on public.project_validation_experiments;
create trigger dirty_learning_experiments after insert or update or delete on public.project_validation_experiments for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_decisions on public.project_decisions;
create trigger dirty_learning_decisions after insert on public.project_decisions for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_assumptions on public.project_assumptions;
create trigger dirty_learning_assumptions after insert or update or delete on public.project_assumptions for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_stage_history on public.project_stage_history;
create trigger dirty_learning_stage_history after insert on public.project_stage_history for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_lifecycle on public.project_lifecycle_events;
create trigger dirty_learning_lifecycle after insert on public.project_lifecycle_events for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_validation_paths on public.validation_path_events;
create trigger dirty_learning_validation_paths after insert on public.validation_path_events for each row execute function public.mark_founder_learning_dirty();
drop trigger if exists dirty_learning_reflections on public.project_closure_reflections;
create trigger dirty_learning_reflections after insert or update or delete on public.project_closure_reflections for each row execute function public.mark_founder_learning_dirty();

create or replace function public.record_founder_pattern_feedback(p_insight_id uuid,p_feedback_type text,p_reason text,p_excluded_project_id uuid,p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); safe_reason text:=nullif(left(trim(coalesce(p_reason,'')),1200),'');
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null or p_feedback_type not in ('useful','dismiss','correct','exclude_project','incomplete_data','circumstances_changed') then raise exception 'Invalid feedback request.'; end if;
  if not exists(select 1 from public.founder_pattern_insights i where i.id=p_insight_id and i.user_id=actor) then raise exception 'Insight not found.'; end if;
  if p_feedback_type in ('correct','exclude_project','incomplete_data','circumstances_changed') and coalesce(length(safe_reason),0)<8 then raise exception 'Add a short explanation.'; end if;
  if p_feedback_type='exclude_project' and not exists(select 1 from public.opportunity_projects p where p.id=p_excluded_project_id and p.user_id=actor) then raise exception 'Project not found.'; end if;
  insert into public.founder_pattern_feedback(insight_id,user_id,feedback_type,reason,excluded_project_id,request_id)
  values(p_insight_id,actor,p_feedback_type,safe_reason,case when p_feedback_type='exclude_project' then p_excluded_project_id else null end,p_request_id) on conflict(user_id,request_id) do nothing;
  if p_feedback_type='dismiss' then update public.founder_pattern_insights set status='dismissed' where id=p_insight_id and user_id=actor and status='active'; end if;
  if p_feedback_type in ('correct','exclude_project','incomplete_data','circumstances_changed') then update public.founder_pattern_insights set status='corrected' where id=p_insight_id and user_id=actor and status='active'; end if;
  insert into public.founder_learning_state(user_id,dirty_at,updated_at) values(actor,now(),now()) on conflict(user_id) do update set dirty_at=excluded.dirty_at,updated_at=excluded.updated_at;
  return true;
end $$;

create or replace function public.set_project_learning_inclusion(p_project_id uuid,p_include boolean,p_reason text,p_mark_synthetic boolean,p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); safe_reason text:=nullif(left(trim(coalesce(p_reason,'')),500),'');
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null then raise exception 'Request id required.'; end if;
  if not exists(select 1 from public.opportunity_projects p where p.id=p_project_id and p.user_id=actor) then raise exception 'Project not found.'; end if;
  if not p_include and coalesce(length(safe_reason),0)<8 then raise exception 'Add a short exclusion reason.'; end if;
  update public.opportunity_projects set learning_excluded_at=case when p_include then null else now() end,learning_exclusion_reason=case when p_include then null else safe_reason end,is_synthetic=case when p_include then false else p_mark_synthetic end where id=p_project_id and user_id=actor;
  return true;
end $$;

create or replace function public.publish_founder_learning_calculation(p_user_id uuid,p_request_id uuid,p_current_fingerprints jsonb,p_data_through timestamptz)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_user_id is null or p_request_id is null or jsonb_typeof(coalesce(p_current_fingerprints,'[]'::jsonb))<>'array' then raise exception 'Invalid learning publication.'; end if;
  update public.founder_pattern_insights i set status='superseded'
  where i.user_id=p_user_id and i.status='active' and not exists(select 1 from jsonb_array_elements_text(p_current_fingerprints) f(value) where f.value=i.evidence_fingerprint);
  update public.founder_pattern_insights set status='active' where user_id=p_user_id and calculation_request_id=p_request_id and status='pending';
  update public.founder_learning_state set calculated_at=now(),data_through=p_data_through,calculation_started_at=null,calculation_request_id=null,last_error_category=null,updated_at=now()
  where user_id=p_user_id and calculation_request_id=p_request_id;
  delete from public.founder_pattern_insights where user_id=p_user_id and status='pending' and calculation_request_id<>p_request_id and generated_at<now()-interval '1 hour';
  return true;
end $$;

alter table public.founder_timeline_events drop constraint if exists founder_timeline_events_origin_system_check;
alter table public.founder_timeline_events add constraint founder_timeline_events_origin_system_check check(origin_system in ('project','lifecycle','validation','proof_board','decision','progression','reflection','value_proof','founder_learning'));

create or replace function public.timeline_from_founder_pattern() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare change_type text; title_text text;
begin
  if (tg_op='INSERT' and new.status='active') or (tg_op='UPDATE' and old.status='pending' and new.status='active') then
    change_type:=case when exists(select 1 from public.founder_pattern_insights i where i.user_id=new.user_id and i.insight_key=new.insight_key and i.id<>new.id and i.status='superseded') then 'founder_pattern_updated' else 'founder_pattern_identified' end;
    title_text:=case when change_type='founder_pattern_updated' then 'A founder pattern changed' else 'A repeated founder pattern was identified' end;
    perform public.emit_founder_timeline_event(new.user_id,null,change_type,'learning',title_text,new.headline,'system_verified','founder_learning','founder_pattern_insights',new.id::text,'founder-pattern:'||new.id::text,null,null,null,null,null,null,jsonb_build_object('insight_id',new.id,'category',new.category,'evidence_tier',new.evidence_tier),new.generated_at);
  elsif tg_op='UPDATE' and old.status='active' and new.status='corrected' then
    perform public.emit_founder_timeline_event(new.user_id,null,'founder_pattern_corrected','learning','Founder corrected a pattern',new.headline,'manual_detailed','founder_learning','founder_pattern_insights',new.id::text,'founder-pattern:'||new.id::text||':corrected',null,null,null,null,null,null,jsonb_build_object('insight_id',new.id,'category',new.category),now());
  elsif tg_op='UPDATE' and old.status='active' and new.status='superseded' then
    if not exists(select 1 from public.founder_pattern_insights i where i.user_id=new.user_id and i.insight_key=new.insight_key and i.status='pending') then
      perform public.emit_founder_timeline_event(new.user_id,null,'founder_pattern_updated','learning','A previous founder pattern changed',old.headline,'system_verified','founder_learning','founder_pattern_insights',new.id::text,'founder-pattern:'||new.id::text||':superseded',null,null,null,null,null,null,jsonb_build_object('insight_id',new.id,'category',new.category),now());
    end if;
  end if;
  return new;
end $$;
drop trigger if exists founder_pattern_timeline_trigger on public.founder_pattern_insights;
create trigger founder_pattern_timeline_trigger after insert or update of status on public.founder_pattern_insights for each row execute function public.timeline_from_founder_pattern();

create or replace function public.invalidate_deleted_project_learning() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.founder_pattern_insights i set status='superseded' where i.user_id=old.user_id and i.status='active' and exists(select 1 from public.founder_pattern_insight_sources s where s.insight_id=i.id and s.project_id=old.id);
  insert into public.founder_learning_state(user_id,dirty_at,updated_at) values(old.user_id,now(),now()) on conflict(user_id) do update set dirty_at=excluded.dirty_at,updated_at=excluded.updated_at;
  return old;
end $$;
drop trigger if exists invalidate_learning_before_project_delete on public.opportunity_projects;
create trigger invalidate_learning_before_project_delete before delete on public.opportunity_projects for each row execute function public.invalidate_deleted_project_learning();

insert into public.founder_learning_state(user_id,dirty_at,updated_at) select id,now(),now() from public.profiles on conflict(user_id) do nothing;
insert into public.founder_project_learning_snapshots(project_id,user_id,project_type,hours_per_week,budget_amount,budget_band,risk_tolerance,technical_ability,source_updated_at,calculated_at)
select p.id,p.user_id,p.business_type,public.learning_json_number(p.report_json,array['input','timePerWeek']),public.learning_json_number(p.report_json,array['input','budget']),
case when public.learning_json_number(p.report_json,array['input','budget']) is null then null when public.learning_json_number(p.report_json,array['input','budget'])<=50 then 'under_50' when public.learning_json_number(p.report_json,array['input','budget'])<=250 then '51_to_250' when public.learning_json_number(p.report_json,array['input','budget'])<=1000 then '251_to_1000' else 'over_1000' end,
public.learning_json_number(p.report_json,array['input','riskTolerance'])::integer,case when lower(coalesce(p.report_json#>>'{input,skills}','')) ~ '(cod|program|develop|engineer|technical)' then 'recorded_technical_skill' else 'technical_skill_not_recorded' end,p.updated_at,now()
from public.opportunity_projects p on conflict(project_id) do nothing;

revoke all on function public.learning_json_number(jsonb,text[]) from public,anon,authenticated;
revoke all on function public.seed_project_learning_context() from public,anon,authenticated;
revoke all on function public.mark_founder_learning_dirty() from public,anon,authenticated;
revoke all on function public.timeline_from_founder_pattern() from public,anon,authenticated;
revoke all on function public.invalidate_deleted_project_learning() from public,anon,authenticated;
revoke all on function public.invalidate_excluded_project_learning() from public,anon,authenticated;
revoke all on function public.record_founder_pattern_feedback(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.record_founder_pattern_feedback(uuid,text,text,uuid,uuid) to authenticated,service_role;
revoke all on function public.set_project_learning_inclusion(uuid,boolean,text,boolean,uuid) from public,anon;
grant execute on function public.set_project_learning_inclusion(uuid,boolean,text,boolean,uuid) to authenticated,service_role;
revoke all on function public.publish_founder_learning_calculation(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.publish_founder_learning_calculation(uuid,uuid,jsonb,timestamptz) to service_role;

comment on table public.founder_pattern_insights is 'Deterministic, reconstructable founder patterns. Unsupported AI prose is never a source of truth.';
comment on table public.founder_pattern_insight_sources is 'Owner-scoped provenance linking each pattern to supporting or contradicting source projects and records.';

commit;
