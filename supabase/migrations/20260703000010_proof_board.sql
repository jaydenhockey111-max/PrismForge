-- PrismForge Proof Board: project validation experiments and evidence logs.

create table if not exists public.project_validation_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  goal text,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'paused')),
  channel text check (channel is null or channel in ('DMs', 'interviews', 'survey', 'landing page', 'TikTok', 'Reddit', 'school', 'email', 'other')),
  hypothesis text,
  target_audience text,
  task_description text,
  people_contacted integer not null default 0 check (people_contacted >= 0),
  replies integer not null default 0 check (replies >= 0),
  pain_confirmed integer not null default 0 check (pain_confirmed >= 0),
  interested_users integer not null default 0 check (interested_users >= 0),
  waitlist_signups integer not null default 0 check (waitlist_signups >= 0),
  payment_intent integer not null default 0 check (payment_intent >= 0),
  preorders_or_revenue_cents integer not null default 0 check (preorders_or_revenue_cents >= 0),
  key_quotes text,
  learnings text,
  next_action text,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists project_validation_experiments_set_updated_at on public.project_validation_experiments;
create trigger project_validation_experiments_set_updated_at before update on public.project_validation_experiments
for each row execute function public.set_updated_at();

create index if not exists project_validation_experiments_user_project_idx
on public.project_validation_experiments(user_id, project_id);

create index if not exists project_validation_experiments_project_created_idx
on public.project_validation_experiments(project_id, created_at desc);

alter table public.project_validation_experiments enable row level security;

drop policy if exists "Users can read their own validation experiments" on public.project_validation_experiments;
create policy "Users can read their own validation experiments"
on public.project_validation_experiments for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create their own validation experiments" on public.project_validation_experiments;
create policy "Users can create their own validation experiments"
on public.project_validation_experiments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_projects p
    where p.id = project_validation_experiments.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their own validation experiments" on public.project_validation_experiments;
create policy "Users can update their own validation experiments"
on public.project_validation_experiments for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_projects p
    where p.id = project_validation_experiments.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own validation experiments" on public.project_validation_experiments;
create policy "Users can delete their own validation experiments"
on public.project_validation_experiments for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.project_validation_experiments to authenticated;
