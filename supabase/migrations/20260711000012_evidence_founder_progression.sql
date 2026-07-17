-- PrismForge Tier 2C: evidence-based, server-authoritative founder progression.
-- Historical totals are preserved as legacy progress. New XP is append-only and source-backed.

alter table public.user_xp
  add column if not exists legacy_xp integer not null default 0 check (legacy_xp >= 0);
alter table public.user_xp alter column title set default 'Explorer';

update public.user_xp set legacy_xp = greatest(legacy_xp, total_xp);

insert into public.app_events(user_id,event_name,metadata)
select user_id,'legacy_xp_migrated',jsonb_build_object('legacy_xp',legacy_xp)
from public.user_xp where legacy_xp > 0;

alter table public.xp_events
  add column if not exists project_id uuid references public.opportunity_projects(id) on delete set null,
  add column if not exists progression_category text not null default 'legacy',
  add column if not exists base_xp integer not null default 0,
  add column if not exists verification_multiplier numeric(4,2) not null default 0,
  add column if not exists awarded_xp integer not null default 0,
  add column if not exists verification_level text not null default 'self_reported',
  add column if not exists source_type text not null default 'legacy',
  add column if not exists source_id text,
  add column if not exists reason text not null default 'Legacy progress retained from the previous system.',
  add column if not exists event_status text not null default 'legacy',
  add column if not exists reverses_event_id uuid references public.xp_events(id) on delete restrict;

update public.xp_events
set progression_category = 'legacy',
    base_xp = greatest(0, xp_delta),
    verification_multiplier = 0,
    awarded_xp = xp_delta,
    verification_level = 'self_reported',
    source_type = 'legacy',
    source_id = coalesce(source_id, id::text),
    reason = 'Legacy progress retained; it is not presented as verified founder evidence.',
    event_status = 'legacy'
where event_status = 'legacy';

alter table public.xp_events
  drop constraint if exists xp_events_progression_category_check,
  add constraint xp_events_progression_category_check check (progression_category in ('project_structure','quest','next_action','evidence','experiment','decision','milestone','launch','revenue','learning','legacy','adjustment')),
  drop constraint if exists xp_events_verification_level_check,
  add constraint xp_events_verification_level_check check (verification_level in ('system_verified','evidence_supported','manual_detailed','self_reported','legacy')),
  drop constraint if exists xp_events_event_status_check,
  add constraint xp_events_event_status_check check (event_status in ('awarded','reversed','correction','legacy','rejected')),
  drop constraint if exists xp_events_base_xp_check,
  add constraint xp_events_base_xp_check check (base_xp >= 0),
  drop constraint if exists xp_events_verification_multiplier_check,
  add constraint xp_events_verification_multiplier_check check (verification_multiplier between 0 and 1);

create index if not exists xp_events_user_status_created_idx on public.xp_events(user_id, event_status, created_at desc);
create index if not exists xp_events_project_created_idx on public.xp_events(project_id, created_at desc) where project_id is not null;
create index if not exists xp_events_source_idx on public.xp_events(user_id, source_type, source_id);
create index if not exists xp_events_reverses_idx on public.xp_events(reverses_event_id) where reverses_event_id is not null;

create table if not exists public.founder_level_rewards (
  level integer primary key check (level between 2 and 50),
  reward_key text not null unique,
  label text not null,
  reward_type text not null check (reward_type in ('recognition','presentation','personalization','small_utility')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.founder_level_rewards (level, reward_key, label, reward_type, config)
values
  (2, 'explorer_marker', 'Explorer profile marker', 'recognition', '{}'),
  (3, 'problem_investigator_title', 'Problem Investigator title', 'recognition', '{}'),
  (5, 'evidence_history_style', 'Evidence-history presentation', 'presentation', '{}'),
  (6, 'validator_title', 'Validator title', 'recognition', '{}'),
  (10, 'builder_workspace_accent', 'Builder title and workspace accent', 'presentation', '{}'),
  (15, 'operator_title', 'Operator title', 'recognition', '{}'),
  (21, 'launcher_history_marker', 'Launcher project-history marker', 'presentation', '{}'),
  (30, 'revenue_builder_title', 'Revenue Builder title', 'recognition', '{}'),
  (40, 'experienced_founder_title', 'Experienced Founder title', 'recognition', '{}')
on conflict (level) do update set label = excluded.label, reward_type = excluded.reward_type, config = excluded.config, active = true;

create table if not exists public.founder_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  level integer not null references public.founder_level_rewards(level) on delete restrict,
  reward_key text not null,
  granted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, reward_key)
);
create index if not exists founder_reward_grants_user_idx on public.founder_reward_grants(user_id, granted_at desc);

create table if not exists public.progression_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.opportunity_projects(id) on delete set null,
  reason text not null,
  severity text not null default 'review' check (severity in ('notice','review','high')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists progression_flags_open_idx on public.progression_flags(created_at desc) where resolved_at is null;
create index if not exists progression_flags_user_idx on public.progression_flags(user_id, created_at desc);

create table if not exists public.project_closure_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  outcome text not null check (outcome in ('completed','paused','archived','abandoned')),
  what_was_learned text not null check (char_length(what_was_learned) between 12 and 1200),
  strongest_evidence text not null check (char_length(strongest_evidence) between 12 and 1200),
  biggest_mistake text,
  closure_reason text not null check (char_length(closure_reason) between 12 and 1200),
  would_do_differently text not null check (char_length(would_do_differently) between 12 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);
drop trigger if exists project_closure_reflections_set_updated_at on public.project_closure_reflections;
create trigger project_closure_reflections_set_updated_at before update on public.project_closure_reflections for each row execute function public.set_updated_at();
create index if not exists project_closure_reflections_project_idx on public.project_closure_reflections(project_id);

alter table public.founder_level_rewards enable row level security;
alter table public.founder_reward_grants enable row level security;
alter table public.progression_flags enable row level security;
alter table public.project_closure_reflections enable row level security;

drop policy if exists "Authenticated users can read founder level rewards" on public.founder_level_rewards;
create policy "Authenticated users can read founder level rewards" on public.founder_level_rewards for select to authenticated using (active = true or public.is_admin());
drop policy if exists "Users can read their founder reward grants" on public.founder_reward_grants;
create policy "Users can read their founder reward grants" on public.founder_reward_grants for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
drop policy if exists "Admins can read progression flags" on public.progression_flags;
create policy "Admins can read progression flags" on public.progression_flags for select to authenticated using (public.is_admin());
drop policy if exists "Users can manage their project closure reflections" on public.project_closure_reflections;
create policy "Users can manage their project closure reflections" on public.project_closure_reflections for all to authenticated
using ((select auth.uid()) = user_id or public.is_admin())
with check ((select auth.uid()) = user_id and exists (select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = (select auth.uid())));

grant select on public.user_levels, public.user_xp, public.xp_events, public.founder_level_rewards, public.founder_reward_grants to authenticated;
grant select, insert, update on public.project_closure_reflections to authenticated;
revoke insert, update, delete on public.xp_events, public.founder_reward_grants, public.progression_flags from anon, authenticated;

create or replace function public.founder_title_for_level(level_value integer)
returns text language sql immutable set search_path = '' as $$
  select case
    when level_value >= 40 then 'Experienced Founder'
    when level_value >= 30 then 'Revenue Builder'
    when level_value >= 21 then 'Launcher'
    when level_value >= 15 then 'Operator'
    when level_value >= 10 then 'Builder'
    when level_value >= 6 then 'Validator'
    when level_value >= 3 then 'Problem Investigator'
    else 'Explorer'
  end;
$$;

delete from public.user_levels;
insert into public.user_levels (level, threshold_xp, title)
select candidate,
  case when candidate = 1 then 0 else round(80 * power(candidate - 1, 1.85))::integer end,
  public.founder_title_for_level(candidate)
from generate_series(1, 50) as candidate;

with calculated as (
  select ux.user_id, coalesce(max(ul.level), 1)::integer as level
  from public.user_xp ux
  left join public.user_levels ul on ul.threshold_xp <= ux.total_xp
  group by ux.user_id
)
update public.user_xp ux
set level = calculated.level,
    title = public.founder_title_for_level(calculated.level)
from calculated where calculated.user_id = ux.user_id;

-- Retire game-like reward templates and obsolete opportunity-hunting quests without deleting history.
update public.mystery_rewards set active = false where active = true;
update public.daily_quests set active = false where active = true;

create or replace function public.record_founder_xp_event(
  p_user_id uuid,
  p_project_id uuid,
  p_event_type text,
  p_verification_level text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(inserted boolean, awarded_xp integer, level_before integer, level_after integer, total_xp integer, rejection_reason text)
language plpgsql security definer set search_path = '' as $$
declare
  current_row public.user_xp%rowtype;
  event_category text;
  base_amount integer;
  multiplier numeric(4,2);
  final_amount integer;
  next_total integer;
  next_level integer;
  burst_count integer;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or p_source_id is null or length(trim(p_source_id)) < 1 then
    raise exception 'Progress events require a source and idempotency key.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Progress user not found.'; end if;
  if p_project_id is not null and not exists (select 1 from public.opportunity_projects where id = p_project_id and user_id = p_user_id) then
    raise exception 'Progress source does not belong to this user.';
  end if;

  select r.base_xp, r.category into base_amount, event_category
  from (values
    ('project_context_completed',25,'project_structure'), ('next_best_action_completed',20,'next_action'),
    ('proof_experiment_defined',15,'experiment'), ('proof_evidence_recorded',20,'evidence'),
    ('proof_experiment_completed',35,'experiment'), ('evidence_based_decision',25,'decision'),
    ('first_customer_contact',20,'milestone'), ('five_customer_contacts',35,'milestone'),
    ('ten_customer_contacts',25,'milestone'), ('first_customer_reply',20,'milestone'),
    ('three_customer_replies',40,'milestone'), ('first_pain_confirmation',25,'milestone'),
    ('three_pain_confirmations',50,'milestone'), ('first_interest_signal',35,'milestone'),
    ('first_waitlist_signal',45,'milestone'), ('first_payment_intent',65,'revenue'),
    ('first_revenue',90,'revenue'), ('daily_quest_completed',15,'quest'),
    ('weekly_quest_completed',35,'quest'), ('project_closed_reflection',35,'learning')
  ) as r(event_type, base_xp, category) where r.event_type = p_event_type;
  if base_amount is null then raise exception 'Progress event type is not allowed.'; end if;

  multiplier := case p_verification_level
    when 'system_verified' then 1.0 when 'evidence_supported' then 1.0
    when 'manual_detailed' then 0.5 when 'self_reported' then 0.0 else null end;
  if multiplier is null then raise exception 'Verification level is not allowed.'; end if;
  final_amount := round(base_amount * multiplier)::integer;

  insert into public.user_xp (user_id, title) values (p_user_id, 'Explorer') on conflict (user_id) do nothing;
  select * into current_row from public.user_xp where user_id = p_user_id for update;
  if final_amount <= 0 then
    insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'xp_event_rejected',jsonb_build_object('event_type',p_event_type,'reason','unsupported_self_report','project_id',p_project_id));
    return query select false,0,current_row.level,current_row.level,current_row.total_xp,'unsupported_self_report'; return;
  end if;
  if exists (select 1 from public.xp_events where user_id = p_user_id and idempotency_key = p_idempotency_key) then
    insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'xp_event_duplicate_prevented',jsonb_build_object('event_type',p_event_type,'project_id',p_project_id));
    return query select false, 0, current_row.level, current_row.level, current_row.total_xp, 'duplicate'; return;
  end if;

  select count(*)::integer into burst_count from public.xp_events where user_id = p_user_id and event_status = 'awarded' and created_at >= now() - interval '2 minutes';
  if burst_count >= 30 then
    insert into public.progression_flags(user_id,project_id,reason,severity,metadata) values (p_user_id,p_project_id,'unrealistic_progress_burst','review',jsonb_build_object('event_count',burst_count));
    insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'suspicious_progress_pattern_detected',jsonb_build_object('reason','unrealistic_progress_burst','project_id',p_project_id));
    return query select false, 0, current_row.level, current_row.level, current_row.total_xp, 'held_for_review'; return;
  end if;

  insert into public.xp_events(user_id,action,xp_delta,project_id,progression_category,base_xp,verification_multiplier,awarded_xp,verification_level,source_type,source_id,idempotency_key,reason,event_status,metadata)
  values (p_user_id,p_event_type,final_amount,p_project_id,event_category,base_amount,multiplier,final_amount,p_verification_level,p_source_type,p_source_id,p_idempotency_key,left(p_reason,240),'awarded',coalesce(p_metadata,'{}'::jsonb));

  next_total := greatest(0, current_row.total_xp + final_amount);
  select coalesce(max(level),1)::integer into next_level from public.user_levels where threshold_xp <= next_total;
  update public.user_xp set total_xp = next_total, level = next_level, title = public.founder_title_for_level(next_level) where user_id = p_user_id;
  insert into public.founder_reward_grants(user_id,level,reward_key,metadata)
    select p_user_id,r.level,r.reward_key,jsonb_build_object('level_reached',next_level)
    from public.founder_level_rewards r where r.active and r.level > current_row.level and r.level <= next_level
    on conflict (user_id,reward_key) do nothing;
  if next_level > current_row.level then
    insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'level_reward_granted',jsonb_build_object('level_before',current_row.level,'level_after',next_level));
  end if;
  insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'xp_event_awarded',jsonb_build_object('event_type',p_event_type,'category',event_category,'awarded_xp',final_amount,'verification_level',p_verification_level,'project_id',p_project_id,'level_before',current_row.level,'level_after',next_level));
  if next_level > current_row.level then insert into public.app_events(user_id,event_name,metadata) values (p_user_id,'level_reached',jsonb_build_object('level_before',current_row.level,'level_after',next_level)); end if;
  return query select true, final_amount, current_row.level, next_level, next_total, null::text;
exception when unique_violation then
  return query select false, 0, coalesce(current_row.level,1), coalesce(current_row.level,1), coalesce(current_row.total_xp,0), 'duplicate';
end;
$$;

create or replace function public.reverse_founder_xp_event(p_user_id uuid, p_event_id uuid, p_reason text, p_idempotency_key text)
returns table(inserted boolean, awarded_xp integer, level_before integer, level_after integer, total_xp integer)
language plpgsql security definer set search_path = '' as $$
declare original public.xp_events%rowtype; current_row public.user_xp%rowtype; next_total integer; next_level integer;
begin
  select * into original from public.xp_events where id = p_event_id and user_id = p_user_id and event_status = 'awarded';
  if original.id is null then raise exception 'Award event not found.'; end if;
  select * into current_row from public.user_xp where user_id = p_user_id for update;
  if exists (select 1 from public.xp_events where user_id=p_user_id and idempotency_key=p_idempotency_key) then return query select false,0,current_row.level,current_row.level,current_row.total_xp; return; end if;
  insert into public.xp_events(user_id,action,xp_delta,project_id,progression_category,base_xp,verification_multiplier,awarded_xp,verification_level,source_type,source_id,idempotency_key,reason,event_status,reverses_event_id,metadata)
  values(p_user_id,'progress_reversal',-original.awarded_xp,original.project_id,'adjustment',original.base_xp,1,-original.awarded_xp,'system_verified','reversal',original.id::text,p_idempotency_key,left(p_reason,240),'reversed',original.id,'{}');
  next_total := greatest(0,current_row.total_xp-original.awarded_xp);
  select coalesce(max(level),1)::integer into next_level from public.user_levels where threshold_xp <= next_total;
  update public.user_xp set total_xp=next_total,level=next_level,title=public.founder_title_for_level(next_level) where user_id=p_user_id;
  insert into public.app_events(user_id,event_name,metadata) values(p_user_id,'xp_event_reversed',jsonb_build_object('event_id',p_event_id,'xp_delta',-original.awarded_xp,'level_before',current_row.level,'level_after',next_level));
  return query select true,-original.awarded_xp,current_row.level,next_level,next_total;
end;
$$;

-- The old arbitrary-XP RPC is retained as a no-op for compatibility and locked to server use.
create or replace function public.record_xp_event(p_user_id uuid,p_action text,p_xp integer,p_opportunity_id uuid default null,p_category text default null,p_idempotency_key text default null,p_metadata jsonb default '{}'::jsonb)
returns table(inserted boolean,level_before integer,level_after integer,total_xp integer)
language plpgsql security definer set search_path = '' as $$
declare current_row public.user_xp%rowtype;
begin
  insert into public.user_xp(user_id,title) values(p_user_id,'Explorer') on conflict(user_id) do nothing;
  select * into current_row from public.user_xp where user_id=p_user_id;
  return query select false,current_row.level,current_row.level,current_row.total_xp;
end;
$$;

revoke all on function public.record_founder_xp_event(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.reverse_founder_xp_event(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_xp_event(uuid,text,integer,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_founder_xp_event(uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.reverse_founder_xp_event(uuid,uuid,text,text) to service_role;
grant execute on function public.record_xp_event(uuid,text,integer,uuid,text,text,jsonb) to service_role;

create or replace function public.prevent_xp_event_mutation() returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'XP history is append-only. Use a reversal or correction event.';
end;
$$;
drop trigger if exists xp_events_append_only on public.xp_events;
create trigger xp_events_append_only before update or delete on public.xp_events for each row execute function public.prevent_xp_event_mutation();
