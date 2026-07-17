-- QuestMint Founder CRM Memory: persistent execution-tool outputs per project.

create table if not exists public.project_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  output_type text not null check (output_type in (
    'landing_page_copy',
    'validation_survey',
    'competitive_battlecard',
    'pricing_tiers',
    'video_scripts',
    'sprint_tasks'
  )),
  content_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_outputs_content_json_is_object_or_array
    check (jsonb_typeof(content_json) in ('object', 'array')),
  unique (project_id, user_id, output_type)
);

drop trigger if exists project_outputs_set_updated_at on public.project_outputs;
create trigger project_outputs_set_updated_at before update on public.project_outputs
for each row execute function public.set_updated_at();

create index if not exists project_outputs_project_type_idx
on public.project_outputs(project_id, output_type);

create index if not exists project_outputs_user_updated_idx
on public.project_outputs(user_id, updated_at desc);

alter table public.project_outputs enable row level security;

drop policy if exists "Users can read their own project outputs" on public.project_outputs;
create policy "Users can read their own project outputs"
on public.project_outputs for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Users can create their own project outputs" on public.project_outputs;
create policy "Users can create their own project outputs"
on public.project_outputs for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_projects p
    where p.id = project_outputs.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their own project outputs" on public.project_outputs;
create policy "Users can update their own project outputs"
on public.project_outputs for update to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.opportunity_projects p
    where p.id = project_outputs.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own project outputs" on public.project_outputs;
create policy "Users can delete their own project outputs"
on public.project_outputs for delete to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

grant select, insert, update, delete on public.project_outputs to authenticated;
