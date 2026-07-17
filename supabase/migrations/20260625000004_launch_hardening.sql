-- QuestMint launch hardening: safer notifications, useful rewards, audit logs, and support indexes.

-- Reward chests should feel meaningful and last long enough to matter.
insert into public.mystery_rewards (reward_key, name, description, weight, metadata, active)
values
  ('double_xp_7d', 'Double XP for 7 days', 'Every XP action is doubled for the next week.', 45, '{"duration_days":7}', true),
  ('bonus_xp_250', '+250 XP burst', 'A quick boost toward your next level.', 28, '{"bonus_xp":250}', true),
  ('bonus_xp_500', '+500 XP burst', 'A rare boost for serious momentum.', 15, '{"bonus_xp":500}', true),
  ('streak_freeze', 'Streak freeze', 'Protect your streak once if you miss a day.', 10, '{"freezes":1}', true),
  ('premium_trial_7d', 'Premium trial for 7 days', 'Try unlimited matches and faster alerts for one week.', 2, '{"duration_days":7}', true)
on conflict (reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  weight = excluded.weight,
  metadata = excluded.metadata,
  active = excluded.active;

update public.mystery_rewards
set active = false
where reward_key in ('double_xp_24h', 'premium_trial_3d', 'cosmetic_badge', 'bonus_theme', 'hidden_tag');

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  recipient text not null,
  email_type text not null,
  status text not null check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  recipient text not null,
  subject text not null,
  html text not null,
  email_type text not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger email_queue_set_updated_at before update on public.email_queue
for each row execute function public.set_updated_at();

create index if not exists email_queue_status_next_attempt_idx
on public.email_queue(status, next_attempt_at, created_at);

create index if not exists email_queue_user_created_idx
on public.email_queue(user_id, created_at desc);

create index if not exists email_delivery_logs_status_created_idx
on public.email_delivery_logs(status, created_at desc);

create index if not exists email_delivery_logs_user_created_idx
on public.email_delivery_logs(user_id, created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_actor_created_idx
on public.admin_audit_logs(actor_id, created_at desc);

create index if not exists admin_audit_logs_action_created_idx
on public.admin_audit_logs(action, created_at desc);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'completed', 'canceled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_deletion_requests_user_idx
on public.account_deletion_requests(user_id, requested_at desc);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_name_created_idx
on public.app_events(event_name, created_at desc);

create table if not exists public.rate_limit_buckets (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rate_limit_buckets_set_updated_at before update on public.rate_limit_buckets
for each row execute function public.set_updated_at();

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  current_row public.rate_limit_buckets%rowtype;
  reset_window boolean := false;
begin
  if p_key is null or char_length(p_key) < 3 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.rate_limit_buckets (key, count, window_start)
  values (p_key, 0, now())
  on conflict (key) do nothing;

  select *
  into current_row
  from public.rate_limit_buckets
  where key = p_key
  for update;

  reset_window := current_row.window_start + make_interval(secs => p_window_seconds) <= now();

  if reset_window then
    update public.rate_limit_buckets
    set count = 1,
        window_start = now()
    where key = p_key;
    return true;
  end if;

  if current_row.count >= p_limit then
    return false;
  end if;

  update public.rate_limit_buckets
  set count = count + 1
  where key = p_key;
  return true;
end;
$$;

-- Indexes that matter once the database grows.
create index if not exists opportunities_status_created_idx
on public.opportunities(status, created_at desc);

create index if not exists opportunities_status_category_deadline_idx
on public.opportunities(status, category, deadline);

create index if not exists xp_events_user_idempotency_idx
on public.xp_events(user_id, idempotency_key)
where idempotency_key is not null;

create index if not exists user_rewards_user_trigger_idx
on public.user_rewards(user_id, trigger);

create index if not exists user_xp_premium_trial_idx
on public.user_xp(premium_trial_until)
where premium_trial_until is not null;

create or replace function public.title_for_level(level_value integer)
returns text
language sql
immutable
as $$
  select case
    when level_value >= 50 then 'Life Optimization Master'
    when level_value >= 30 then 'Elite Opportunity Strategist'
    when level_value >= 20 then 'Grant Hunter'
    when level_value >= 10 then 'Scholarship Scout'
    when level_value >= 5 then 'Opportunity Explorer'
    else 'Beginner Hunter'
  end;
$$;

create or replace function public.record_xp_event(
  p_user_id uuid,
  p_action text,
  p_xp integer,
  p_opportunity_id uuid default null,
  p_category text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(inserted boolean, level_before integer, level_after integer, total_xp integer)
language plpgsql
security definer set search_path = ''
as $$
declare
  current_row public.user_xp%rowtype;
  multiplier integer := 1;
  xp_delta integer := 0;
  next_total integer := 0;
  next_level integer := 1;
begin
  insert into public.user_xp (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into current_row
  from public.user_xp
  where user_id = p_user_id
  for update;

  if p_idempotency_key is not null and exists (
    select 1 from public.xp_events
    where user_id = p_user_id and idempotency_key = p_idempotency_key
  ) then
    return query select false, current_row.level, current_row.level, current_row.total_xp;
    return;
  end if;

  if current_row.xp_multiplier_until is not null and current_row.xp_multiplier_until > now() then
    multiplier := 2;
  end if;

  xp_delta := greatest(0, coalesce(p_xp, 0) * multiplier);

  insert into public.xp_events (
    user_id,
    action,
    xp_delta,
    opportunity_id,
    category,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_action,
    xp_delta,
    p_opportunity_id,
    p_category,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('multiplier', multiplier)
  );

  next_total := current_row.total_xp + xp_delta;
  next_level := least(50, floor(sqrt(next_total::numeric / 100))::integer + 1);

  update public.user_xp
  set total_xp = next_total,
      level = next_level,
      title = public.title_for_level(next_level)
  where user_id = p_user_id;

  return query select true, current_row.level, next_level, next_total;
exception
  when unique_violation then
    return query select false, current_row.level, current_row.level, current_row.total_xp;
end;
$$;

alter table public.email_delivery_logs enable row level security;
alter table public.email_queue enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.app_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

drop policy if exists "Admins can read email delivery logs" on public.email_delivery_logs;
create policy "Admins can read email delivery logs"
on public.email_delivery_logs for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can read email queue" on public.email_queue;
create policy "Admins can read email queue"
on public.email_queue for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
on public.admin_audit_logs for select to authenticated
using (public.is_admin());

drop policy if exists "Users can read their deletion requests" on public.account_deletion_requests;
create policy "Users can read their deletion requests"
on public.account_deletion_requests for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can request account deletion" on public.account_deletion_requests;
create policy "Users can request account deletion"
on public.account_deletion_requests for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins can read app events" on public.app_events;
create policy "Admins can read app events"
on public.app_events for select to authenticated
using (public.is_admin());

drop policy if exists "Authenticated users can read challenge members" on public.challenge_members;
create policy "Users can read their own challenge memberships"
on public.challenge_members for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read challenge progress" on public.challenge_progress;
create policy "Users can read their own challenge progress"
on public.challenge_progress for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Service-role routes write logs and events. Authenticated users should not write monitoring rows directly.
