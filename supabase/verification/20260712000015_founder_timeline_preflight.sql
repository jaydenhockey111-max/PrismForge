-- Run before migration 15. Save this single-row snapshot with the release record.
select
  (select count(*) from public.opportunity_projects) as projects,
  (select count(*) from public.project_lifecycle_events) as lifecycle_events,
  (select count(*) from public.project_decisions) as decisions,
  (select count(*) from public.project_validation_experiments) as proof_experiments,
  (select count(*) from public.xp_events) as xp_events,
  (select count(*) from public.project_closure_reflections) as closure_reflections,
  (select count(*) from public.profiles) as profiles;

