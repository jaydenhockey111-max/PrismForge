-- Run before Tier 3B. Save this row with the release record.
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.opportunity_projects) as projects,
  (select count(*) from public.project_validation_experiments) as experiments,
  (select count(*) from public.project_decisions) as decisions,
  (select count(*) from public.project_assumptions) as assumptions,
  (select count(*) from public.validation_path_events) as validation_path_events,
  (select count(*) from public.project_stage_history) as stage_events,
  (select count(*) from public.project_lifecycle_events) as lifecycle_events,
  (select count(*) from public.project_closure_reflections) as closure_reflections,
  (select count(*) from public.founder_timeline_events) as timeline_events;

