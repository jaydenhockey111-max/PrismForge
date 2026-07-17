-- Read-only Tier 2E post-migration verification. Run only after migration 14.
select count(*) as total_projects from public.opportunity_projects;
select user_id,count(*) as projects_per_user from public.opportunity_projects group by user_id order by count(*) desc;
select coalesce(lifecycle_status,'<missing>') as lifecycle_status,count(*) from public.opportunity_projects group by lifecycle_status order by lifecycle_status;
select count(*) as soft_deleted_projects from public.opportunity_projects where deleted_at is not null;
select count(*) as invalid_focus_references from public.founder_project_focus f left join public.opportunity_projects p on p.id=f.project_id where p.id is null or p.user_id<>f.user_id or p.deleted_at is not null or p.lifecycle_status<>'active';
select user_id,count(*) as focus_rows from public.founder_project_focus group by user_id having count(*)>1;
select count(*) as orphaned_experiments from public.project_validation_experiments e left join public.opportunity_projects p on p.id=e.project_id where p.id is null;
select count(*) as orphaned_outputs from public.project_outputs o left join public.opportunity_projects p on p.id=o.project_id where p.id is null;
select count(*) as orphaned_validation_paths from public.validation_paths v left join public.opportunity_projects p on p.id=v.project_id where p.id is null;
select count(*) as evidence_count from public.project_validation_experiments;
select count(*) as xp_event_count,sum(awarded_xp) as awarded_xp_total from public.xp_events;
select count(*) as quest_count from public.user_daily_quests;
select count(*) as closure_reflection_count from public.project_closure_reflections;
select count(*) as lifecycle_event_count from public.project_lifecycle_events;
select count(*) as permanent_delete_tombstone_count from public.deleted_project_tombstones;
