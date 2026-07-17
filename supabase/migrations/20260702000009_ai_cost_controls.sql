-- PrismForge beta AI cost controls.
-- Adds a durable feature-usage ledger and allows Startup Team outputs to be cached in project_outputs.

update public.profiles
set role = 'user'
where lower(email) <> 'jayden.hockey111@gmail.com'
  and role = 'admin';

update public.profiles
set role = 'admin'
where lower(email) = 'jayden.hockey111@gmail.com';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) = 'jayden.hockey111@gmail.com'
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.feature_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.opportunity_projects(id) on delete set null,
  feature text not null check (feature in (
    'opportunity_report',
    'ceo_ai',
    'marketer_ai',
    'designer_ai',
    'engineer_ai',
    'validation_survey',
    'competitive_battlecard',
    'pricing_tiers',
    'video_scripts',
    'sprint_tasks',
    'market_pulse_refresh',
    'founder_brief'
  )),
  source text not null check (source in ('openai', 'fallback', 'cache', 'blocked')),
  model text,
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens between 0 and 10000),
  approx_prompt_size integer check (approx_prompt_size is null or approx_prompt_size >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  reason text,
  success boolean not null default true,
  error_category text,
  usage_month date not null default date_trunc('month', now())::date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.feature_usage_events
add column if not exists success boolean not null default true;

alter table public.feature_usage_events
add column if not exists error_category text;

alter table public.feature_usage_events
drop constraint if exists feature_usage_events_feature_check;

alter table public.feature_usage_events
add constraint feature_usage_events_feature_check
check (feature in (
  'opportunity_report',
  'ceo_ai',
  'marketer_ai',
  'designer_ai',
  'engineer_ai',
  'validation_survey',
  'competitive_battlecard',
  'pricing_tiers',
  'video_scripts',
  'sprint_tasks',
  'market_pulse_refresh',
  'founder_brief'
));

alter table public.feature_usage_events
drop constraint if exists feature_usage_events_source_check;

alter table public.feature_usage_events
add constraint feature_usage_events_source_check
check (source in ('openai', 'fallback', 'cache', 'blocked'));

create index if not exists feature_usage_events_user_feature_month_idx
on public.feature_usage_events(user_id, feature, usage_month, created_at desc);

create index if not exists feature_usage_events_project_feature_created_idx
on public.feature_usage_events(project_id, feature, created_at desc);

create index if not exists feature_usage_events_source_created_idx
on public.feature_usage_events(source, created_at desc);

alter table public.feature_usage_events enable row level security;

drop policy if exists "Admins can read all feature usage events" on public.feature_usage_events;
create policy "Admins can read all feature usage events"
on public.feature_usage_events for select to authenticated
using (public.is_admin());

drop policy if exists "Users can read their own feature usage events" on public.feature_usage_events;
create policy "Users can read their own feature usage events"
on public.feature_usage_events for select to authenticated
using (user_id = auth.uid());

grant select on public.feature_usage_events to authenticated;

alter table public.project_outputs
drop constraint if exists project_outputs_output_type_check;

alter table public.project_outputs
add constraint project_outputs_output_type_check
check (output_type in (
  'landing_page_copy',
  'validation_survey',
  'competitive_battlecard',
  'pricing_tiers',
  'video_scripts',
  'sprint_tasks',
  'ceo_directive',
  'marketer_gtm_plan',
  'designer_wireframe',
  'engineer_boilerplate'
));
