-- Automated opportunity ingestion metadata and audit history.

alter table public.opportunities
  add column source_name text not null default 'manual',
  add column source_id text,
  add column source_url text,
  add column source_updated_at timestamptz,
  add column first_seen_at timestamptz not null default now(),
  add column last_seen_at timestamptz not null default now(),
  add column eligibility_summary text,
  add column review_status text not null default 'approved'
    check (review_status in ('approved', 'pending', 'rejected')),
  add column checksum text,
  add column raw_data jsonb;

alter table public.opportunities
  add constraint opportunities_source_identity_unique unique (source_name, source_id);

create index opportunities_source_idx on public.opportunities(source_name, last_seen_at desc);
create index opportunities_review_status_idx on public.opportunities(review_status, status);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  discovered_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  archived_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index ingestion_runs_source_started_idx
  on public.ingestion_runs(source_name, started_at desc);

alter table public.ingestion_runs enable row level security;

create policy "Admins can read ingestion history"
on public.ingestion_runs for select to authenticated
using (public.is_admin());

-- Writes are intentionally service-role only. Import jobs never trust browser input.

