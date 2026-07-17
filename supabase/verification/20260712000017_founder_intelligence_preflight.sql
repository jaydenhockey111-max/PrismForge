select
  (select count(*) from public.profiles) as founders,
  (select count(*) from public.founder_project_learning_snapshots where eligibility_status <> 'ineligible') as eligible_project_snapshots,
  (select count(*) from public.founder_pattern_insights where status='active') as active_patterns,
  (select count(*) from public.founder_pattern_insights where status='dismissed') as dismissed_patterns,
  (select count(*) from public.founder_pattern_insights where status='corrected') as corrected_patterns,
  (select count(*) from public.opportunity_projects where is_synthetic) as synthetic_projects,
  (select count(*) from public.opportunity_projects where deleted_at is not null) as deleted_projects;

