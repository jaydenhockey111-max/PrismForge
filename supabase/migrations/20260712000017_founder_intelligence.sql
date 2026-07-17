-- PrismForge Tier 3C: Founder Intelligence and Adaptive Guidance.
-- Additive, idempotent, owner-scoped, and safe to leave in place during app rollback.

create table if not exists public.founder_guidance_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  guidance_mode text not null default 'balanced' check (guidance_mode in ('guided','balanced','autonomous')),
  explanation_depth text not null default 'standard' check (explanation_depth in ('brief','standard','detailed')),
  quest_intensity text not null default 'standard' check (quest_intensity in ('light','standard','ambitious')),
  historical_personalization_enabled boolean not null default true,
  show_historical_reminders boolean not null default true,
  show_personalization_reasons boolean not null default true,
  preference_version integer not null default 1 check (preference_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_intelligence_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_version integer not null default 1 check (profile_version > 0),
  status text not null default 'dirty' check (status in ('dirty','calculating','ready','error')),
  profile_json jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_json) = 'object'),
  learning_version integer not null default 0 check (learning_version >= 0),
  generated_at timestamptz,
  data_through timestamptz,
  dirty_at timestamptz not null default now(),
  calculation_started_at timestamptz,
  calculation_request_id uuid,
  last_error_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_guidance_preference_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('preferences_updated','personalization_reset')),
  request_id uuid not null,
  previous_preferences jsonb not null default '{}'::jsonb,
  next_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, request_id, event_type)
);

create index if not exists founder_guidance_preferences_updated_idx on public.founder_guidance_preferences(user_id, updated_at desc);
create index if not exists founder_intelligence_profiles_status_idx on public.founder_intelligence_profiles(user_id, status, dirty_at desc);
create index if not exists founder_guidance_preference_events_user_idx on public.founder_guidance_preference_events(user_id, created_at desc);

alter table public.founder_guidance_preferences enable row level security;
alter table public.founder_intelligence_profiles enable row level security;
alter table public.founder_guidance_preference_events enable row level security;

drop policy if exists "Founders read own guidance preferences" on public.founder_guidance_preferences;
create policy "Founders read own guidance preferences" on public.founder_guidance_preferences for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
drop policy if exists "Founders read own intelligence profile" on public.founder_intelligence_profiles;
create policy "Founders read own intelligence profile" on public.founder_intelligence_profiles for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
drop policy if exists "Founders read own preference history" on public.founder_guidance_preference_events;
create policy "Founders read own preference history" on public.founder_guidance_preference_events for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

revoke all on public.founder_guidance_preferences from anon;
revoke all on public.founder_intelligence_profiles from anon;
revoke all on public.founder_guidance_preference_events from anon;
revoke all on public.founder_guidance_preferences from authenticated;
revoke all on public.founder_intelligence_profiles from authenticated;
revoke all on public.founder_guidance_preference_events from authenticated;
grant select on public.founder_guidance_preferences to authenticated;
grant select on public.founder_intelligence_profiles to authenticated;
grant select on public.founder_guidance_preference_events to authenticated;
grant all on public.founder_guidance_preferences to service_role;
grant all on public.founder_intelligence_profiles to service_role;
grant all on public.founder_guidance_preference_events to service_role;

create or replace function public.mark_founder_intelligence_dirty_for(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user_id is null then return; end if;
  insert into public.founder_intelligence_profiles(user_id,status,dirty_at,updated_at)
  values(p_user_id,'dirty',now(),now())
  on conflict(user_id) do update set status='dirty',dirty_at=now(),updated_at=now(),last_error_category=null;
end;
$$;
revoke all on function public.mark_founder_intelligence_dirty_for(uuid) from public, anon, authenticated;
grant execute on function public.mark_founder_intelligence_dirty_for(uuid) to service_role;

create or replace function public.mark_founder_intelligence_dirty_from_learning()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mark_founder_intelligence_dirty_for(new.user_id);
  return new;
end;
$$;
revoke all on function public.mark_founder_intelligence_dirty_from_learning() from public, anon, authenticated;

drop trigger if exists founder_learning_dirties_intelligence on public.founder_learning_state;
create trigger founder_learning_dirties_intelligence
after insert or update of dirty_at,calculation_version on public.founder_learning_state
for each row execute function public.mark_founder_intelligence_dirty_from_learning();

create or replace function public.update_founder_guidance_preferences(
  p_guidance_mode text,
  p_explanation_depth text,
  p_quest_intensity text,
  p_historical_personalization_enabled boolean,
  p_show_historical_reminders boolean,
  p_show_personalization_reasons boolean,
  p_request_id uuid
) returns public.founder_guidance_preferences
language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); previous_row public.founder_guidance_preferences; result_row public.founder_guidance_preferences;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null then raise exception 'Request id is required.'; end if;
  if p_guidance_mode not in ('guided','balanced','autonomous') then raise exception 'Invalid guidance mode.'; end if;
  if p_explanation_depth not in ('brief','standard','detailed') then raise exception 'Invalid explanation depth.'; end if;
  if p_quest_intensity not in ('light','standard','ambitious') then raise exception 'Invalid quest intensity.'; end if;

  select * into previous_row from public.founder_guidance_preferences where user_id=actor;
  if exists(select 1 from public.founder_guidance_preference_events where user_id=actor and request_id=p_request_id and event_type='preferences_updated') then
    select * into result_row from public.founder_guidance_preferences where user_id=actor;
    return result_row;
  end if;

  insert into public.founder_guidance_preferences(
    user_id,guidance_mode,explanation_depth,quest_intensity,historical_personalization_enabled,
    show_historical_reminders,show_personalization_reasons,preference_version,updated_at
  ) values (
    actor,p_guidance_mode,p_explanation_depth,p_quest_intensity,p_historical_personalization_enabled,
    p_show_historical_reminders,p_show_personalization_reasons,1,now()
  ) on conflict(user_id) do update set
    guidance_mode=excluded.guidance_mode,explanation_depth=excluded.explanation_depth,quest_intensity=excluded.quest_intensity,
    historical_personalization_enabled=excluded.historical_personalization_enabled,show_historical_reminders=excluded.show_historical_reminders,
    show_personalization_reasons=excluded.show_personalization_reasons,
    preference_version=public.founder_guidance_preferences.preference_version+1,updated_at=now()
  returning * into result_row;

  insert into public.founder_guidance_preference_events(user_id,event_type,request_id,previous_preferences,next_preferences)
  values(actor,'preferences_updated',p_request_id,coalesce(to_jsonb(previous_row),'{}'::jsonb),to_jsonb(result_row)) on conflict do nothing;
  perform public.mark_founder_intelligence_dirty_for(actor);
  return result_row;
end;
$$;
revoke all on function public.update_founder_guidance_preferences(text,text,text,boolean,boolean,boolean,uuid) from public, anon;
grant execute on function public.update_founder_guidance_preferences(text,text,text,boolean,boolean,boolean,uuid) to authenticated;

create or replace function public.reset_founder_personalization(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_request_id is null then raise exception 'Request id is required.'; end if;
  if exists(select 1 from public.founder_guidance_preference_events where user_id=actor and request_id=p_request_id and event_type='personalization_reset') then return true; end if;
  insert into public.founder_intelligence_profiles(user_id,status,profile_json,dirty_at,updated_at)
  values(actor,'dirty','{}'::jsonb,now(),now())
  on conflict(user_id) do update set status='dirty',profile_json='{}'::jsonb,dirty_at=now(),updated_at=now(),last_error_category=null;
  insert into public.founder_guidance_preference_events(user_id,event_type,request_id)
  values(actor,'personalization_reset',p_request_id) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.reset_founder_personalization(uuid) from public, anon;
grant execute on function public.reset_founder_personalization(uuid) to authenticated;

insert into public.founder_guidance_preferences(user_id)
select id from public.profiles on conflict(user_id) do nothing;
insert into public.founder_intelligence_profiles(user_id,status)
select id,'dirty' from public.profiles on conflict(user_id) do nothing;

