-- Continuous web discovery, source trust, and quarantine tables.

create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  base_url text not null check (base_url ~ '^https?://'),
  source_type text not null check (source_type in ('api', 'rss', 'website', 'search')),
  trust_level text not null default 'unverified' check (trust_level in ('official', 'trusted', 'unverified', 'blocked')),
  auto_publish boolean not null default false,
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_crawled_at timestamptz,
  next_crawl_at timestamptz,
  crawl_interval_minutes integer not null default 1440 check (crawl_interval_minutes between 60 and 43200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger source_registry_set_updated_at before update on public.source_registry
for each row execute function public.set_updated_at();

create table public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique check (canonical_url ~ '^https?://'),
  domain text not null,
  discovered_by text not null,
  search_query text,
  source_title text,
  source_snippet text,
  raw_content text,
  content_hash text,
  extraction jsonb,
  category text check (category is null or category in ('scholarship', 'grant', 'tax_credit', 'government_rebate', 'internship', 'research_program', 'competition')),
  deadline date,
  confidence integer not null default 0 check (confidence between 0 and 100),
  trust_level text not null default 'unverified' check (trust_level in ('official', 'trusted', 'unverified', 'blocked')),
  status text not null default 'discovered' check (status in ('discovered', 'published', 'quarantined', 'rejected', 'error')),
  status_reason text,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger discovery_candidates_set_updated_at before update on public.discovery_candidates
for each row execute function public.set_updated_at();

create index discovery_candidates_status_confidence_idx
  on public.discovery_candidates(status, confidence desc, last_seen_at desc);
create index discovery_candidates_domain_idx on public.discovery_candidates(domain, last_seen_at desc);

alter table public.source_registry enable row level security;
alter table public.discovery_candidates enable row level security;

create policy "Admins can manage source registry"
on public.source_registry for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins can read discovery candidates"
on public.discovery_candidates for select to authenticated
using (public.is_admin());

create policy "Admins can review discovery candidates"
on public.discovery_candidates for update to authenticated
using (public.is_admin()) with check (public.is_admin());

insert into public.source_registry (name, domain, base_url, source_type, trust_level, auto_publish)
values
  ('Grants.gov', 'grants.gov', 'https://www.grants.gov', 'api', 'official', true),
  ('USAJOBS', 'usajobs.gov', 'https://www.usajobs.gov', 'api', 'official', true)
on conflict (domain) do nothing;

