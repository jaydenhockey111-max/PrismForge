-- QuestMint Founder OS: generated opportunity reports and saved founder projects.

create table if not exists public.opportunity_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  business_type text not null check (business_type in ('saas', 'ai_tool', 'digital_product', 'local_service', 'content_business', 'e_commerce')),
  target_customer text not null check (char_length(target_customer) between 2 and 500),
  score integer not null check (score between 0 and 100),
  status text not null default 'idea' check (status in ('idea', 'validating', 'building', 'launched')),
  report_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_projects_report_json_is_object check (jsonb_typeof(report_json) = 'object')
);

drop trigger if exists opportunity_projects_set_updated_at on public.opportunity_projects;
create trigger opportunity_projects_set_updated_at before update on public.opportunity_projects
for each row execute function public.set_updated_at();

create index if not exists opportunity_projects_user_created_idx
on public.opportunity_projects(user_id, created_at desc);

create index if not exists opportunity_projects_user_score_idx
on public.opportunity_projects(user_id, score desc);

create index if not exists opportunity_projects_user_status_idx
on public.opportunity_projects(user_id, status, updated_at desc);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  input_json jsonb not null,
  output_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint generation_history_input_json_is_object check (jsonb_typeof(input_json) = 'object'),
  constraint generation_history_output_json_is_object check (jsonb_typeof(output_json) = 'object')
);

create index if not exists generation_history_user_created_idx
on public.generation_history(user_id, created_at desc);

alter table public.opportunity_projects enable row level security;
alter table public.generation_history enable row level security;

drop policy if exists "Users can read their own founder projects" on public.opportunity_projects;
create policy "Users can read their own founder projects"
on public.opportunity_projects for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create their own founder projects" on public.opportunity_projects;
create policy "Users can create their own founder projects"
on public.opportunity_projects for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can update their own founder projects" on public.opportunity_projects;
create policy "Users can update their own founder projects"
on public.opportunity_projects for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can delete their own founder projects" on public.opportunity_projects;
create policy "Users can delete their own founder projects"
on public.opportunity_projects for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their own generation history" on public.generation_history;
create policy "Users can read their own generation history"
on public.generation_history for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create their own generation history" on public.generation_history;
create policy "Users can create their own generation history"
on public.generation_history for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

-- Authenticated clients only need user-scoped access through RLS.
grant select, insert, update, delete on public.opportunity_projects to authenticated;
grant select, insert on public.generation_history to authenticated;
