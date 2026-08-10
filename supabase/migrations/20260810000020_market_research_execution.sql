-- One durable, read-only autonomous action. Results are secondary research,
-- never customer-validation evidence unless the founder explicitly hands them off.

create table if not exists public.market_research_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.opportunity_projects(id) on delete cascade,
  request_id uuid not null,
  reservation_id uuid not null references public.execution_budget_ledger(id) on delete restrict,
  workflow_run_id text,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  execution_type text not null default 'market_research' check (execution_type = 'market_research'),
  route_key text not null,
  target_assumption_key text not null,
  validation_path_id uuid references public.validation_paths(id) on delete set null,
  target_assumption_id uuid references public.project_assumptions(id) on delete set null,
  result_json jsonb,
  failure_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  unique (reservation_id)
);

create index if not exists market_research_executions_project_idx
  on public.market_research_executions(project_id, created_at desc);

alter table public.market_research_executions enable row level security;
revoke all on public.market_research_executions from public, anon;
grant select on public.market_research_executions to authenticated;
grant select, insert, update on public.market_research_executions to service_role;

create policy "Users can read their own market research executions"
  on public.market_research_executions for select to authenticated
  using (auth.uid() = user_id);

alter table public.project_validation_experiments
  add column if not exists evidence_provenance text check (evidence_provenance in ('founder_reported','secondary_research','ai_secondary_research')),
  add column if not exists source_urls text[] not null default '{}';

comment on table public.market_research_executions is 'Durable autonomous market research jobs. Result provenance is always AI secondary research.';
comment on column public.project_validation_experiments.evidence_provenance is 'Evidence origin; AI secondary research is not customer validation.';
