begin;

create table if not exists public.core_value_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  rating text not null check (rating in ('yes', 'somewhat', 'no')),
  decision_summary text check (decision_summary is null or char_length(decision_summary) <= 500),
  recommendation_more_useful boolean,
  contact_permission boolean not null default false,
  contact_preference text check (contact_preference is null or contact_preference in ('account_email')),
  milestone_category text check (milestone_category is null or char_length(milestone_category) <= 80),
  request_id uuid not null,
  submitted_at timestamptz not null default now(),
  permission_updated_at timestamptz,
  unique (user_id, project_id),
  unique (user_id, request_id)
);

create index if not exists core_value_feedback_user_submitted_idx
  on public.core_value_feedback(user_id, submitted_at desc);
create index if not exists core_value_feedback_project_idx
  on public.core_value_feedback(project_id);

alter table public.core_value_feedback enable row level security;

drop policy if exists "Founders can read their core value feedback" on public.core_value_feedback;
create policy "Founders can read their core value feedback"
on public.core_value_feedback for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.opportunity_projects project
    where project.id = core_value_feedback.project_id
      and project.user_id = (select auth.uid())
  )
);

drop policy if exists "Founders can insert their core value feedback" on public.core_value_feedback;
create policy "Founders can insert their core value feedback"
on public.core_value_feedback for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.opportunity_projects project
    where project.id = core_value_feedback.project_id
      and project.user_id = (select auth.uid())
  )
);

drop policy if exists "Founders can update their core value feedback" on public.core_value_feedback;
create policy "Founders can update their core value feedback"
on public.core_value_feedback for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.opportunity_projects project
    where project.id = core_value_feedback.project_id
      and project.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.opportunity_projects project
    where project.id = core_value_feedback.project_id
      and project.user_id = (select auth.uid())
  )
);

revoke all on table public.core_value_feedback from public, anon, authenticated;
grant select, insert, update on table public.core_value_feedback to authenticated;
grant all on table public.core_value_feedback to service_role;

comment on table public.core_value_feedback is
  'Private, founder-owned beta feedback and explicit research-contact permission. Free-form content is excluded from app_events.';

commit;
