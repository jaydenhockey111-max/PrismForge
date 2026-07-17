do $$ begin
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='founder_guidance_preferences') then raise exception 'founder_guidance_preferences missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='founder_intelligence_profiles') then raise exception 'founder_intelligence_profiles missing'; end if;
  if not exists(select 1 from pg_tables where schemaname='public' and tablename='founder_guidance_preference_events') then raise exception 'founder_guidance_preference_events missing'; end if;
  if not exists(select 1 from pg_class where relname='founder_guidance_preferences' and relrowsecurity) then raise exception 'guidance preference RLS disabled'; end if;
  if not exists(select 1 from pg_class where relname='founder_intelligence_profiles' and relrowsecurity) then raise exception 'intelligence profile RLS disabled'; end if;
  if has_table_privilege('anon','public.founder_guidance_preferences','select') then raise exception 'anon can read guidance preferences'; end if;
  if has_table_privilege('authenticated','public.founder_intelligence_profiles','insert') then raise exception 'authenticated can directly insert derived profiles'; end if;
  if has_function_privilege('anon','public.update_founder_guidance_preferences(text,text,text,boolean,boolean,boolean,uuid)','execute') then raise exception 'anon can update preferences'; end if;
end $$;

select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'founder_%intelligence%' or tablename='founder_guidance_preferences';
select indexname from pg_indexes where schemaname='public' and indexname like 'founder_%guidance%' order by indexname;
