-- PrismForge end-of-beta helper.
-- Run this after you have granted lifetime Founder access to feedback completers.
-- It expires temporary Founder beta access for everyone who did not complete the feedback form.

update public.profiles
set
  beta_access_until = now(),
  plan = 'free'
where lifetime_founder is not true
  and beta_feedback_completed is not true;

-- Stop automatically giving new signups a one-week Founder beta window.
alter table public.profiles
alter column beta_access_until drop default;

-- Optional check: confirms remaining Founder-like access.
select
  email,
  plan,
  lifetime_founder,
  beta_feedback_completed,
  beta_access_until
from public.profiles
where lifetime_founder = true
   or beta_feedback_completed = true
   or beta_access_until > now()
order by lifetime_founder desc, beta_access_until desc nulls last, email;
