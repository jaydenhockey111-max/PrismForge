-- QuestMint initial schema
-- Run this in the Supabase SQL editor, or with: supabase db push

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  age integer check (age between 13 and 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  income_range text check (income_range is null or income_range in ('under_25k', '25k_50k', '50k_100k', '100k_200k', 'over_200k')),
  student_status text check (student_status is null or student_status in ('not_student', 'high_school', 'undergraduate', 'graduate', 'vocational')),
  occupation text,
  interests text[] not null default '{}',
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  stripe_customer_id text unique,
  alerts_enabled boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 20 and 5000),
  deadline date,
  category text not null check (category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition')),
  eligibility_rules jsonb not null default '{}'::jsonb,
  url text not null check (url ~ '^https?://'),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eligibility_rules_is_object check (jsonb_typeof(eligibility_rules) = 'object')
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  notification_type text not null check (notification_type in ('new_match', 'deadline_reminder')),
  sent_at timestamptz not null default now(),
  unique (user_id, opportunity_id, notification_type)
);

create index opportunities_status_deadline_idx on public.opportunities(status, deadline);
create index opportunities_created_at_idx on public.opportunities(created_at desc);
create index profiles_plan_alerts_idx on public.profiles(plan, alerts_enabled) where plan = 'premium';
create index notification_logs_user_idx on public.notification_logs(user_id, sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SECURITY DEFINER avoids recursive profile policies when checking admin status.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notification_logs enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Authenticated users can read published opportunities"
on public.opportunities for select to authenticated
using (status = 'published' or public.is_admin());

create policy "Admins can create opportunities"
on public.opportunities for insert to authenticated
with check (public.is_admin());

create policy "Admins can update opportunities"
on public.opportunities for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete opportunities"
on public.opportunities for delete to authenticated
using (public.is_admin());

create policy "Users can read their own subscription"
on public.subscriptions for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Users can read their notification history"
on public.notification_logs for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Prevent signed-in users from promoting themselves or changing billing-owned fields.
-- RLS controls rows; these column grants control which fields the client may change.
revoke update on public.profiles from authenticated;
grant update (name, age, state, income_range, student_status, occupation, interests, alerts_enabled, onboarding_completed)
on public.profiles to authenticated;

-- Stripe webhook and cron routes use the service-role key, which bypasses RLS.
