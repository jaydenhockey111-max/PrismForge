-- Read-only Tier 2E preflight. Run before migration 14 and save the single result row.
select
  (select count(*) from public.opportunity_projects) as total_projects,
  (select count(*) from public.project_validation_experiments) as evidence_count,
  (select count(*) from public.project_outputs) as output_count,
  (select count(*) from public.xp_events) as xp_event_count,
  (select coalesce(sum(awarded_xp),0) from public.xp_events) as awarded_xp_total,
  (select count(*) from public.user_daily_quests) as quest_count,
  (select count(*) from public.project_closure_reflections) as closure_reflection_count;

