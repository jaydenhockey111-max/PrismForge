begin;

alter table public.core_value_feedback
  alter column rating drop not null,
  add column if not exists prompt_dismissed_at timestamptz,
  add column if not exists prompt_eligible_after timestamptz;

comment on column public.core_value_feedback.prompt_eligible_after is
  'Server-authoritative earliest time an unanswered optional core-value prompt may be shown again.';

commit;
