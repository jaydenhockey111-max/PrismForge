-- PrismForge beta founder access controls.
-- Adds durable entitlement fields for temporary beta access, lifetime founder grants,
-- and beta feedback completion tracking.

alter table public.profiles
add column if not exists beta_access_until timestamptz;

alter table public.profiles
add column if not exists lifetime_founder boolean not null default false;

alter table public.profiles
add column if not exists beta_feedback_completed boolean not null default false;

alter table public.profiles
add column if not exists beta_feedback_completed_at timestamptz;

create index if not exists profiles_beta_access_until_idx
on public.profiles(beta_access_until)
where beta_access_until is not null;

create index if not exists profiles_lifetime_founder_idx
on public.profiles(lifetime_founder)
where lifetime_founder = true;

create index if not exists profiles_beta_feedback_completed_idx
on public.profiles(beta_feedback_completed)
where beta_feedback_completed = true;

-- Existing beta testers get a one-week Founder beta window from the moment this migration runs.
-- This does not grant admin access and does not bypass OpenAI usage caps.
update public.profiles
set beta_access_until = coalesce(beta_access_until, now() + interval '7 days')
where lifetime_founder is false;

-- New signups during the private beta get a one-week Founder beta window.
-- After beta, remove this default with:
-- alter table public.profiles alter column beta_access_until drop default;
alter table public.profiles
alter column beta_access_until set default (now() + interval '7 days');

-- Keep feedback timestamps consistent.
create or replace function public.set_beta_feedback_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.beta_feedback_completed is true and old.beta_feedback_completed is distinct from true then
    new.beta_feedback_completed_at = coalesce(new.beta_feedback_completed_at, now());
  end if;

  if new.beta_feedback_completed is false then
    new.beta_feedback_completed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_set_beta_feedback_completed_at on public.profiles;
create trigger profiles_set_beta_feedback_completed_at
before update on public.profiles
for each row execute function public.set_beta_feedback_completed_at();

-- Users should not be able to grant themselves beta/lifetime access through client updates.
revoke update on public.profiles from authenticated;
grant update (name, age, state, income_range, student_status, occupation, interests, alerts_enabled, onboarding_completed)
on public.profiles to authenticated;
