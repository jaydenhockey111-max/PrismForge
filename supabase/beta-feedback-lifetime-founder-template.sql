-- PrismForge beta feedback reward helper.
-- Paste Google Form account emails into the values list below, then run this in Supabase SQL Editor.
-- This grants lifetime Founder access to people who completed beta feedback.

with completed_feedback(email) as (
  values
    ('tester@example.com')
    -- , ('another-tester@example.com')
)
update public.profiles p
set
  lifetime_founder = true,
  beta_feedback_completed = true,
  beta_feedback_completed_at = coalesce(p.beta_feedback_completed_at, now()),
  beta_access_until = null
from completed_feedback f
where lower(p.email) = lower(f.email);

-- Optional check: shows who now has lifetime Founder access.
select email, lifetime_founder, beta_feedback_completed, beta_feedback_completed_at
from public.profiles
where lifetime_founder = true
order by beta_feedback_completed_at desc nulls last, email;
