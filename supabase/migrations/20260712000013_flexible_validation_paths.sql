-- PrismForge Tier 2D: deterministic, founder-compatible validation paths.
-- Additive only. Run after 20260711000012_evidence_founder_progression.sql.

create table if not exists public.founder_validation_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  preference text not null check (preference in ('ready_to_talk','private_research_first','clarify_idea','need_something_concrete','test_demand_without_building','test_pricing','prepare_to_launch')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, project_id)
);

create table if not exists public.validation_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  path_type text not null check (path_type in ('project_clarification','private_research','customer_discovery','prototype_test','landing_page_test','waitlist_test','service_pilot','pricing_test','content_test','marketplace_supply_test','marketplace_demand_test','physical_product_test','launch_readiness','post_launch_learning')),
  status text not null default 'recommended' check (status in ('recommended','active','completed','replaced','paused','blocked')),
  source text not null default 'system' check (source in ('system','founder')),
  target_assumption_key text not null,
  target_evidence_type text not null,
  rationale text not null,
  success_condition text not null,
  completion_requirement text not null,
  next_path_hint text,
  selection_reason text,
  recommended_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  replaced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists validation_paths_one_active_per_project_idx on public.validation_paths(project_id) where status = 'active';
create index if not exists validation_paths_project_history_idx on public.validation_paths(project_id, created_at desc);
create index if not exists validation_paths_user_status_idx on public.validation_paths(user_id, status, updated_at desc);

create table if not exists public.validation_path_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  validation_path_id uuid references public.validation_paths(id) on delete set null,
  event_type text not null check (event_type in ('recommended','activated','completed','replaced','paused','blocked','alternative_selected','avoidance_guard_triggered')),
  previous_path_type text,
  next_path_type text,
  reason text,
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists validation_path_events_request_idx on public.validation_path_events(user_id, request_id, event_type);
create index if not exists validation_path_events_project_idx on public.validation_path_events(project_id, created_at desc);

create table if not exists public.project_assumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  assumption_key text not null,
  statement text not null check (char_length(statement) between 8 and 1000),
  status text not null default 'untested' check (status in ('untested','supported','contradicted','inconclusive')),
  source text not null default 'validation_router' check (source in ('validation_router','founder','proof_board')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, project_id, assumption_key)
);
create index if not exists project_assumptions_project_idx on public.project_assumptions(project_id, updated_at desc);

create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  validation_path_id uuid references public.validation_paths(id) on delete set null,
  assumption_id uuid references public.project_assumptions(id) on delete set null,
  experiment_id uuid references public.project_validation_experiments(id) on delete set null,
  decision_type text not null check (decision_type in ('continue','narrow_audience','revise_problem','revise_solution','test_another_segment','test_pricing','build_prototype','pause','abandon','launch')),
  rationale text not null check (char_length(rationale) between 12 and 2000),
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists project_decisions_request_idx on public.project_decisions(user_id, request_id);
create index if not exists project_decisions_project_idx on public.project_decisions(project_id, created_at desc);

create table if not exists public.project_stage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  previous_stage text not null check (previous_stage in ('idea','validating','building','launched')),
  new_stage text not null check (new_stage in ('idea','validating','building','launched')),
  suggested_stage text not null check (suggested_stage in ('idea','validating','building','launched')),
  conflict boolean not null default false,
  reason text,
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists project_stage_history_request_idx on public.project_stage_history(user_id, request_id);
create index if not exists project_stage_history_project_idx on public.project_stage_history(project_id, created_at desc);

alter table public.project_validation_experiments
  add column if not exists validation_path_id uuid references public.validation_paths(id) on delete set null,
  add column if not exists target_assumption_id uuid references public.project_assumptions(id) on delete set null,
  add column if not exists evidence_type text not null default 'other',
  add column if not exists decision_type text,
  add column if not exists request_id uuid;
alter table public.project_validation_experiments drop constraint if exists project_validation_experiments_evidence_type_check;
alter table public.project_validation_experiments add constraint project_validation_experiments_evidence_type_check check (evidence_type in ('problem_interview','research_pattern','prototype_feedback','landing_page_result','waitlist_signup','service_pilot_response','pricing_response','payment_intent','content_response','marketplace_supply_response','marketplace_demand_response','physical_product_feedback','launch_check','post_launch_feedback','other'));
create index if not exists project_validation_experiments_path_idx on public.project_validation_experiments(validation_path_id, created_at desc) where validation_path_id is not null;
create unique index if not exists project_validation_experiments_request_idx on public.project_validation_experiments(user_id, request_id) where request_id is not null;

alter table public.founder_validation_preferences enable row level security;
alter table public.validation_paths enable row level security;
alter table public.validation_path_events enable row level security;
alter table public.project_assumptions enable row level security;
alter table public.project_decisions enable row level security;
alter table public.project_stage_history enable row level security;

drop policy if exists "founders manage own validation preferences" on public.founder_validation_preferences;
create policy "founders manage own validation preferences" on public.founder_validation_preferences for all to authenticated using (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid())) with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "founders manage own validation paths" on public.validation_paths;
create policy "founders manage own validation paths" on public.validation_paths for all to authenticated using (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid())) with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "founders read own validation path events" on public.validation_path_events;
create policy "founders read own validation path events" on public.validation_path_events for select to authenticated using (user_id = auth.uid());
drop policy if exists "founders append own validation path events" on public.validation_path_events;
create policy "founders append own validation path events" on public.validation_path_events for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "founders manage own assumptions" on public.project_assumptions;
create policy "founders manage own assumptions" on public.project_assumptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "founders read own decisions" on public.project_decisions;
create policy "founders read own decisions" on public.project_decisions for select to authenticated using (user_id = auth.uid());
drop policy if exists "founders append own decisions" on public.project_decisions;
create policy "founders append own decisions" on public.project_decisions for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "founders read own stage history" on public.project_stage_history;
create policy "founders read own stage history" on public.project_stage_history for select to authenticated using (user_id = auth.uid());
drop policy if exists "founders append own stage history" on public.project_stage_history;
create policy "founders append own stage history" on public.project_stage_history for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.opportunity_projects p where p.id = project_id and p.user_id = auth.uid()));

revoke all on public.founder_validation_preferences, public.validation_paths, public.validation_path_events, public.project_assumptions, public.project_decisions, public.project_stage_history from anon;
grant select on public.founder_validation_preferences, public.validation_paths, public.validation_path_events, public.project_assumptions, public.project_decisions, public.project_stage_history to authenticated;
grant all on public.founder_validation_preferences, public.validation_paths, public.validation_path_events, public.project_assumptions, public.project_decisions, public.project_stage_history to service_role;

comment on table public.validation_path_events is 'Append-only validation path audit history. Do not grant update or delete to authenticated.';
comment on table public.project_decisions is 'Append-only evidence-based founder decisions.';
comment on table public.project_stage_history is 'Append-only project-stage changes and routing conflicts.';
