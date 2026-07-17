-- PrismForge core-value beta hardening.
-- Reversible grant/search-path changes only; no user data or table shape changes.

alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.title_for_level(integer) set search_path = pg_catalog, public;
alter function public.check_rate_limit(text, integer, integer) set search_path = pg_catalog, public;
alter function public.handle_new_user() set search_path = pg_catalog, public;
alter function public.is_admin() set search_path = pg_catalog, public;
alter function public.touch_project_fields_activity() set search_path = pg_catalog, public;
alter function public.touch_project_meaningful_activity() set search_path = pg_catalog, public;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.touch_project_fields_activity() from public, anon, authenticated;
grant execute on function public.touch_project_fields_activity() to service_role;

revoke all on function public.touch_project_meaningful_activity() from public, anon, authenticated;
grant execute on function public.touch_project_meaningful_activity() to service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function public.check_rate_limit(text, integer, integer) is
  'Server-only rate-limit primitive. Never expose to anon/authenticated PostgREST callers.';
