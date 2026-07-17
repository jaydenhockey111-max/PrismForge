# Tier 2D — Flexible Validation Paths

## Release order

1. Back up the Supabase project or confirm point-in-time recovery is available.
2. In Supabase SQL Editor, run `supabase/migrations/20260711000012_evidence_founder_progression.sql` if it has not already been applied.
3. Run `supabase/migrations/20260712000013_flexible_validation_paths.sql`.
4. Confirm the editor returns `Success. No rows returned.`
5. Deploy the application only after both migrations succeed.

The application degrades safely before migration 13: it can calculate and display a local validation route, but preference, switching, history, assumptions, and decisions remain disabled.

## Smoke test

Use a non-admin account through the normal deployed journey:

1. Sign in and create a project through the standard Create Project form.
2. Open the project. Confirm Today displays one active validation path and one Next Best Action.
3. Open Validate. Confirm the path shows rationale, assumption, completion condition, evidence to record, and no more than two alternatives.
4. Save a founder preference. Refresh and confirm it persists.
5. Start the suggested Proof Board experiment. Confirm its evidence type and path association are prefilled.
6. Save evidence, refresh, and confirm path progress changes without claiming unsupported proof.
7. Switch to an offered alternative with a reason. Confirm the old path remains in history and the Today/Progress quests change.
8. Record a decision and confirm it appears in Project decision history.
9. Change the project stage away from the suggested stage. Confirm a reason is required.
10. Open Launch. Confirm validation blockers link back to their resolution location.
11. Confirm another signed-in user cannot read or mutate this project's paths, assumptions, decisions, or history.

## Rollback

Prefer rolling back the application deployment first. The migration is additive, so leaving its tables in place is safer than dropping founder history under pressure.

If the feature must be disabled, deploy the previous application version. Do not delete validation data. After the incident is understood, remove only the new UI/action calls or ship a feature flag. A destructive schema rollback requires a verified export of:

- `founder_validation_preferences`
- `validation_paths`
- `validation_path_events`
- `project_assumptions`
- `project_decisions`
- `project_stage_history`
- the new linkage columns on `project_validation_experiments`

## Release gate

Do not describe Tier 2D as production-ready until the non-admin deployed smoke test passes after both migrations. Local typecheck, tests, and build are necessary but not sufficient.
