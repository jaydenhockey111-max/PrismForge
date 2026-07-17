-- Run after migration 15. Every assertion must pass.
do $$
begin
  if to_regclass('public.founder_timeline_events') is null then raise exception 'founder_timeline_events is missing'; end if;
  if to_regprocedure('public.search_founder_timeline(uuid,text,text,timestamptz,uuid,integer)') is null then raise exception 'search_founder_timeline is missing'; end if;
  if exists(select 1 from public.founder_timeline_events group by user_id,dedupe_key having count(*)>1) then raise exception 'duplicate canonical timeline events found'; end if;
  if exists(select 1 from public.founder_timeline_events where event_type in ('page_opened','clicked','scrolled','ai_generated','theme_changed','profile_edited')) then raise exception 'meaningless activity entered the founder timeline'; end if;
  if exists(select 1 from public.founder_timeline_events e join public.opportunity_projects p on p.id=e.project_id where e.user_id<>p.user_id) then raise exception 'cross-user project timeline ownership mismatch'; end if;
  if exists(select 1 from public.founder_timeline_events e join public.project_decisions d on d.id=e.decision_id where e.user_id<>d.user_id or e.project_id is distinct from d.project_id) then raise exception 'cross-user decision reference found'; end if;
  if exists(select 1 from public.founder_timeline_events e join public.project_validation_experiments p on p.id=e.proof_experiment_id where e.user_id<>p.user_id or e.project_id is distinct from p.project_id) then raise exception 'cross-user proof reference found'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='founder_timeline_events' and roles @> array['authenticated']::name[]) then raise exception 'timeline RLS select policy is missing'; end if;
  if has_table_privilege('authenticated','public.founder_timeline_events','INSERT') or has_table_privilege('authenticated','public.founder_timeline_events','UPDATE') or has_table_privilege('authenticated','public.founder_timeline_events','DELETE') then raise exception 'authenticated users can mutate append-only timeline rows'; end if;
  if has_function_privilege('authenticated','public.emit_founder_timeline_event(uuid,uuid,text,text,text,text,text,text,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,timestamptz)','EXECUTE') then raise exception 'authenticated users can call the internal timeline emitter'; end if;
end $$;

select category,count(*) as event_count from public.founder_timeline_events group by category order by category;
select origin_system,count(*) as event_count from public.founder_timeline_events group by origin_system order by origin_system;

-- Manual two-account RLS check is still mandatory: authenticate as account B and query an account A event id; zero rows must return.

