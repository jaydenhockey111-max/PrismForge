-- PrismForge Tier 1A: project generation reliability and idempotent atomic creation.

alter table public.generation_history
add column if not exists request_id text,
add column if not exists project_id uuid references public.opportunity_projects(id) on delete set null;

create unique index if not exists generation_history_user_request_unique_idx
on public.generation_history(user_id, request_id)
where request_id is not null;

create index if not exists generation_history_project_idx
on public.generation_history(project_id);

create or replace function public.create_founder_project_atomic(
  p_request_id text,
  p_title text,
  p_business_type text,
  p_target_customer text,
  p_score integer,
  p_report_json jsonb,
  p_input_json jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if p_request_id is not null then
    select project_id
      into v_project_id
      from public.generation_history
      where user_id = v_user_id
        and request_id = p_request_id
        and project_id is not null
      order by created_at desc
      limit 1;

    if v_project_id is not null then
      return v_project_id;
    end if;
  end if;

  insert into public.opportunity_projects (
    user_id,
    title,
    business_type,
    target_customer,
    score,
    report_json
  )
  values (
    v_user_id,
    p_title,
    p_business_type,
    p_target_customer,
    p_score,
    p_report_json
  )
  returning id into v_project_id;

  insert into public.generation_history (
    user_id,
    request_id,
    project_id,
    input_json,
    output_json
  )
  values (
    v_user_id,
    p_request_id,
    v_project_id,
    p_input_json,
    p_report_json
  );

  return v_project_id;
exception
  when unique_violation then
    select project_id
      into v_project_id
      from public.generation_history
      where user_id = v_user_id
        and request_id = p_request_id
        and project_id is not null
      order by created_at desc
      limit 1;

    if v_project_id is not null then
      return v_project_id;
    end if;

    raise;
end;
$$;

grant execute on function public.create_founder_project_atomic(text, text, text, text, integer, jsonb, jsonb) to authenticated;
