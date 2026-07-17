-- Run after Tier 3B. Every assertion must pass.
do $$
declare table_name text;
begin
  foreach table_name in array array['founder_learning_state','founder_project_learning_snapshots','founder_pattern_insights','founder_pattern_insight_sources','founder_pattern_feedback'] loop
    if to_regclass('public.'||table_name) is null then raise exception '% is missing',table_name; end if;
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then raise exception '% does not have RLS',table_name; end if;
    if has_table_privilege('authenticated','public.'||table_name,'INSERT') or has_table_privilege('authenticated','public.'||table_name,'UPDATE') or has_table_privilege('authenticated','public.'||table_name,'DELETE') then raise exception 'authenticated can mutate % directly',table_name; end if;
  end loop;
  if has_function_privilege('authenticated','public.publish_founder_learning_calculation(uuid,uuid,jsonb,timestamptz)','EXECUTE') then raise exception 'authenticated can publish arbitrary founder learning'; end if;
  if not has_function_privilege('authenticated','public.record_founder_pattern_feedback(uuid,text,text,uuid,uuid)','EXECUTE') then raise exception 'feedback RPC is unavailable'; end if;
  if not has_function_privilege('authenticated','public.search_founder_patterns(text,text,integer,integer)','EXECUTE') then raise exception 'owner-scoped insight search is unavailable'; end if;
  if exists(select 1 from public.founder_project_learning_snapshots s join public.opportunity_projects p on p.id=s.project_id where s.user_id<>p.user_id) then raise exception 'cross-user project snapshot found'; end if;
  if exists(select 1 from public.founder_pattern_insight_sources s join public.founder_pattern_insights i on i.id=s.insight_id join public.opportunity_projects p on p.id=s.project_id where s.user_id<>i.user_id or s.user_id<>p.user_id) then raise exception 'cross-user insight source found'; end if;
  if exists(select 1 from public.founder_pattern_insights where status='active' group by user_id,insight_key having count(*)>1) then raise exception 'duplicate active pattern found'; end if;
  if exists(select 1 from public.founder_pattern_insights i where i.status='active' and not exists(select 1 from public.founder_pattern_insight_sources s where s.insight_id=i.id and s.source_role='supporting')) then raise exception 'active pattern without provenance found'; end if;
  if exists(select 1 from public.founder_pattern_insight_sources s join public.founder_pattern_insights i on i.id=s.insight_id join public.opportunity_projects p on p.id=s.project_id where i.status='active' and (p.deleted_at is not null or p.learning_excluded_at is not null or p.is_synthetic)) then raise exception 'active pattern references deleted, excluded, or synthetic project'; end if;
  if exists(select 1 from public.founder_pattern_insights where status='pending' and generated_at<now()-interval '1 hour') then raise exception 'stale pending learning calculation found'; end if;
end $$;

select eligibility_status,count(*) from public.founder_project_learning_snapshots group by eligibility_status order by eligibility_status;
select category,evidence_tier,status,count(*) from public.founder_pattern_insights group by category,evidence_tier,status order by category,evidence_tier,status;
select indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('founder_project_learning_snapshots','founder_pattern_insights','founder_pattern_insight_sources','founder_pattern_feedback') order by tablename,indexname;

-- Manual RLS verification remains mandatory:
-- authenticate as normal account B and request an insight/source ID owned by account A; both queries must return zero rows.
