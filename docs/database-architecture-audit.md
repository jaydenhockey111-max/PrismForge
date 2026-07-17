# PrismForge Database Architecture Audit

Audit date: 2026-07-17  
Live project: `vrbzglmphdmnudhzcrfo` (us-east-1, PostgreSQL 17.6)  
Authoritative corrective migrations: `20260717230826` and `20260717231349`

## Executive result

The live schema had no existing cross-owner rows, invalid focus rows, or duplicate
generation/XP/timeline idempotency keys. The main proven defects were structural:

- project creation committed project/history before best-effort lifecycle/focus registration;
- project-scoped tables trusted application/service-role code to keep `user_id` aligned with the
  canonical project owner;
- evidence, path, assumption, and decision foreign keys could link records from two projects owned
  by the same founder;
- private core tables and one obsolete helper advertised unnecessary anonymous/API privileges;
- core RLS policies repeatedly evaluated `auth.uid()` for every candidate row;
- ten proven foreign-key/history access paths lacked supporting indexes.

The live database now enforces those invariants. No production row was rewritten or deleted.

## 1. Database inventory

The `public` schema contains 62 tables, zero views, and zero materialized views. Every public table
has RLS enabled.

- Identity, billing, privacy (4): `profiles`, `subscriptions`, `account_deletion_requests`,
  `core_value_feedback`.
- Opportunity catalog and operations (12): `opportunities`, `notification_logs`,
  `ingestion_runs`, `source_registry`, `discovery_candidates`, `email_delivery_logs`,
  `email_queue`, `admin_audit_logs`, `app_events`, `rate_limit_buckets`,
  `feature_usage_events`, `progression_flags`.
- Legacy/reconciled gamification (23): `user_levels`, `user_xp`, `xp_events`, `streaks`,
  `daily_quests`, `user_daily_quests`, `badges`, `user_badges`, `mystery_rewards`,
  `user_rewards`, `category_mastery`, `profile_completion`, `money_found_stats`,
  `user_opportunities`, `collections`, `user_collections`, `challenges`,
  `challenge_members`, `challenge_progress`, `founder_level_rewards`,
  `founder_reward_grants`, `project_stage_history`, `deleted_project_tombstones`.
- Founder project core (14): `opportunity_projects`, `generation_history`, `project_outputs`,
  `project_validation_experiments`, `project_closure_reflections`, `founder_project_focus`,
  `project_lifecycle_events`, `founder_validation_preferences`, `validation_paths`,
  `validation_path_events`, `project_assumptions`, `project_decisions`,
  `founder_timeline_events`, `core_value_feedback`.
- Founder learning and guidance (8): `founder_learning_state`,
  `founder_project_learning_snapshots`, `founder_pattern_insights`,
  `founder_pattern_insight_sources`, `founder_pattern_feedback`,
  `founder_guidance_preferences`, `founder_intelligence_profiles`,
  `founder_guidance_preference_events`.
- Central AI infrastructure (2): `ai_runtime_controls`, `ai_requests`.

Some tables appear in two conceptual groups because their operational and product roles overlap;
the physical inventory is de-duplicated in the live catalog.

## 2. Canonical entity map

```text
auth.users
  └─ profiles (identity, plan, admin marker)
      ├─ opportunity_projects (canonical project owner and lifecycle)
      │   ├─ generation_history (idempotent creation input/output)
      │   ├─ founder_project_focus (at most one focus per founder)
      │   ├─ project_lifecycle_events (append-only lifecycle audit)
      │   ├─ project_assumptions (Biggest Question/assumptions)
      │   ├─ validation_paths ── validation_path_events
      │   ├─ project_validation_experiments (evidence)
      │   ├─ project_decisions
      │   ├─ project_outputs
      │   └─ founder_timeline_events (derived meaningful history)
      ├─ user_xp ── xp_events (reconciled balance + immutable ledger)
      ├─ founder learning snapshots/patterns/guidance
      └─ ai_requests (server-only financial and execution ledger)
```

## 3. Sources of truth by concept

| Concept | Source of truth | Derived/cached state |
|---|---|---|
| User identity and plan | `profiles` plus Stripe webhook-owned `subscriptions` | UI entitlements |
| Project ownership | `opportunity_projects.user_id` | repeated child `user_id`, now trigger-enforced |
| Founder stage | `opportunity_projects.status` | `project_stage_history`, timeline |
| Lifecycle | `opportunity_projects.lifecycle_status`, version/timestamps | lifecycle events |
| Current focus | `founder_project_focus` | UI ordering only |
| Biggest Question | `project_assumptions` | route recommendation |
| Evidence | `project_validation_experiments` | confidence/recommendation summaries |
| Validation route | active row in `validation_paths` | deterministic router output |
| Decisions | `project_decisions` | timeline projection |
| XP | immutable `xp_events`; `user_xp` is reconciled balance | level display |
| Founder Timeline | `founder_timeline_events` derived from canonical inserts | search document |
| AI accounting/cache | `ai_requests` | application response only |
| AI runtime controls | `ai_runtime_controls` | in-process short-lived reads |

## 4. Ownership model

- Global lookup/catalog tables are readable only under their explicit active/published policies.
- Operational/admin tables use admin-only RLS or have no ordinary-client grants.
- Founder-owned tables use `user_id`.
- Project-scoped tables use `opportunity_projects.user_id` as canonical ownership.
- Twenty project-scoped tables now have a `BEFORE INSERT/UPDATE` owner trigger. The trigger applies
  even to service-role and migration code, preventing accidental ownership drift.
- Deleted tombstones intentionally do not reference a live project after permanent deletion.

## 5. RLS audit findings

- All public tables have RLS enabled.
- Two normal-user integration identities passed own-row and cross-user denial tests.
- `ai_requests`, `ai_runtime_controls`, and `rate_limit_buckets` intentionally have no policies:
  they are fail-closed and ordinary roles have no table grants.
- Profile update grants are column-scoped. Ordinary users cannot update `role`, `plan`,
  Stripe identifiers, beta access, or founder flags.
- Ordinary clients cannot mutate `user_xp`, `xp_events`, subscriptions, AI ledgers, runtime
  controls, lifecycle events, focus, or timeline rows.
- Remaining Supabase `SECURITY DEFINER` advisor warnings correspond to intentional, validated
  founder RPCs. Their bodies bind the actor to `auth.uid()`, use an empty/fixed search path, and
  validate ownership.
- The post-migration security advisor reports three intentional fail-closed/no-policy information
  notices, the intentional signed-in workflow RPC warnings, and disabled leaked-password
  protection. The obsolete authenticated public lifecycle helper is no longer reported.

## 6. RLS changes

- Removed anonymous grants from the private founder core.
- Replaced raw `auth.uid()` calls with `(select auth.uid())` on the core project, evidence,
  decision, XP, subscription, and profile policies.
- Consolidated two permissive `feature_usage_events` read policies into one.
- Kept admin behavior unchanged through `(select public.is_admin())`.

## 7. Function and RPC security findings

- `create_founder_project_atomic` remains `SECURITY INVOKER`, validates authentication and a UUID
  request key, uses an empty search path, and is executable only by `authenticated`.
- Anonymous execution was removed.
- Lifecycle registration moved to `private.register_project_creation_lifecycle`; `private` is not
  an exposed API schema. The obsolete public helper is service-role-only.
- Trigger enforcement functions have no public/anon/authenticated direct execution grant.
- `public` and `extensions` schemas do not grant `CREATE` to ordinary roles, so the remaining fixed
  search paths cannot be shadowed by untrusted objects.

## 8. Schema integrity findings

Before migration, all sampled and complete live checks were clean:

- 0 project-owner mismatches across core children;
- 0 invalid focus rows;
- 0 cross-project assumption/path/decision links;
- 0 active soft-deleted projects;
- 0 synthetic projects included in learning;
- 0 duplicate generation request keys;
- 0 duplicate timeline dedupe keys;
- 0 duplicate XP idempotency keys.

The absence of bad rows did not substitute for enforcement; triggers now preserve those facts.

## 9. Constraints added or changed

- Added owner-consistency enforcement to 20 project-scoped tables.
- Added same-user/same-project link enforcement to evidence, validation-path events, and decisions.
- Preserved existing check, unique, and foreign-key constraints.
- No column was dropped or rewritten.

## 10. Current Focus architecture

`founder_project_focus.user_id` is the primary key, so a founder has at most one focus.
`project_id` is unique, and owner enforcement ensures it belongs to the same founder. Focus changes
and lifecycle fallback selection run inside locked/upserted database operations. A live check found
zero focus rows pointing to deleted, inactive, missing, or foreign projects.

## 11. Lifecycle architecture

Lifecycle state and optimistic concurrency version live on `opportunity_projects`.
`transition_project_lifecycle` locks the project row, validates the expected version, enforces the
state machine, updates focus and validation paths, and appends an idempotent lifecycle event in one
transaction. Soft deletion provides a 30-day recovery window; permanent deletion requires expiry
and exact-title confirmation.

## 12. Assumption architecture

`project_assumptions` is canonical. `(user_id, project_id, assumption_key)` is unique. Evidence and
decision links must now reference an assumption owned by the same user in the same project.
Recommendation text remains deterministic application output, not a second writable truth.

## 13. Evidence architecture

`project_validation_experiments` is canonical structured evidence. It has nonnegative metric checks,
bounded statuses/types, a unique `(user_id, request_id)` index when a request ID exists, project
ownership enforcement, and same-project path/assumption enforcement. Timeline projection is
trigger-driven and deduplicated.

Existing evidence predating request IDs remains valid. New UI submissions generate UUID request IDs.
Making the legacy nullable column `NOT NULL` is deferred until old integrations and fixtures are
fully migrated.

## 14. Transaction-boundary decisions

- Project + generation history + created lifecycle event + current focus now commit or roll back
  together.
- The app no longer falls back to manual multi-table creation.
- Lifecycle transitions and focus switches remain transactional RPCs.
- Evidence insert plus timeline projection is transactional through triggers. Progress reconciliation
  remains retryable/best-effort and is not financial or ownership authority.

## 15. Idempotency protections

- Project generation: unique `(user_id, request_id)` plus duplicate-return behavior.
- Lifecycle events: unique `(user_id, request_id, event_type)`.
- Evidence: unique `(user_id, request_id)` where present.
- Decisions: unique `(user_id, request_id)`.
- Timeline: unique `(user_id, dedupe_key)`.
- XP: unique `(user_id, idempotency_key)` and one reversal per award.
- AI: request/idempotency keys and atomic reservation/finalization functions.

## 16. XP and quest integrity

`xp_events` is append-only to ordinary roles and guarded against mutation. XP award/reversal RPCs are
service-only. `user_xp` has read-only ordinary access and is reconciled by server operations.
Synthetic/project ownership is enforced when a project is attached. Quest templates are global
lookup rows; user quest state is owner-readable and server-mutated.

## 17. AI usage-record integrity

`ai_requests` and `ai_runtime_controls` have RLS enabled, no ordinary policies, and no anon or
authenticated grants. Reservation/finalization are service-only and use atomic quota/rate/concurrency
controls. Ordinary users cannot read prompts, hashes, costs, provider IDs, or cached result JSON.

## 18. JSON and denormalization findings

JSON is appropriate for generated reports, output payloads, immutable metadata, and reconstructable
learning snapshots. Database checks enforce object/array shape and selected size limits. Operational
ownership, lifecycle, usage, XP, assumptions, evidence metrics, and financial fields remain typed
columns. Application Zod/domain validators remain required for full report/output contracts.

## 19. Duplicate-state findings

`status` (founder stage) and `lifecycle_status` (availability/retention state) are distinct, documented
concepts. `user_xp` is a reconciled projection of `xp_events`, not an independent award source.
Timeline and learning tables are reconstructable projections. No competing current-focus or Biggest
Question table was found.

## 20. Index audit

Core list/detail/history indexes already support user/project and descending time access. Advisor
findings on tiny lookup/junction tables were not blindly indexed. Unused-index notices were not used
as a reason to drop recently added or low-volume beta indexes; statistics are too young.

## 21. Indexes added or removed

Added:

- `ai_runtime_controls_updated_by_idx`
- `app_events_user_created_idx`
- `project_validation_experiments_assumption_idx`
- `project_decisions_assumption_idx`
- `project_decisions_experiment_idx`
- `project_decisions_path_idx`
- `validation_path_events_path_idx`
- `founder_timeline_lifecycle_idx`
- `founder_timeline_path_idx`
- `founder_timeline_xp_idx`

No index was removed.

## 22. Query-performance findings

- Project Library is bounded to 100 projects and 1,000 evidence rows.
- Dashboard uses several parallel count queries; acceptable for beta, but a single aggregate query is
  preferable before 1,000 active users.
- Timeline uses deterministic cursor ordering and bounded fetches.
- Account export is explicitly bounded to 5,000 timeline rows.
- Admin monitoring caps evidence at 2,500 rows; it needs cursor pagination before sustained scale.
- Progress and founder-learning loaders page server-side, but several UI summaries still aggregate in
  application memory.

No latency or payload metric is claimed: a representative production load harness was not available.

## 23. RLS-performance findings

Core policies now use statement-level auth init plans. Owner lookups use indexed project primary keys
and direct `user_id` comparison. One duplicate permissive-policy pair was consolidated. Remaining
legacy gamification policies should be converted before 10,000 users, not during the beta critical
path.

## 24. Pagination changes

No UI pagination behavior changed in this patch. Existing project/timeline/export bounds were
preserved. Before 1,000 active users, add cursor pagination to Project Library evidence aggregation
and admin monitoring. Before 10,000, paginate/aggregate progress history and analytics.

## 25. Migration audit

Historical files remain unchanged. Production migration timestamps differ from some early local
filenames because earlier changes were applied through the connected migration service; obsolete
history must remain. New corrective files use the exact live versions. The repository has no local
`supabase/config.toml`, so a clean local migration replay was not available without installing/linking
the Supabase CLI.

## 26. New migrations

- `20260717230826_database_integrity_hardening.sql`
- `20260717231349_rls_performance_and_rpc_hardening.sql`

Both are live and recorded in `supabase_migrations.schema_migrations`.

## 27. Generated-type changes

The manually maintained repository contract now includes `create_founder_project_atomic`. No
service-role client is imported into browser components. Existing `Relationships: []` placeholders
remain a maintainability limitation; replace the manual file with generated CLI output once the
repository is linked to a Supabase config.

## 28. Data-access-layer changes

Project creation now has one authoritative RPC path. The manual insert/history/delete compensation
path was removed. Existing server actions remain scoped by `requireProfile`, explicit user/project
filters, and RLS.

## 29. Client-versus-server query changes

No privileged operation moved into the browser. AI accounting, XP, lifecycle ownership changes,
admin data, learning publication, and audit writes remain server-side/service-role operations.
Ordinary browser reads remain RLS-protected.

## 30. Cache and revalidation changes

No shared user-private cache was introduced. Existing mutations revalidate project, library,
dashboard, progress, and timeline paths as appropriate. AI exact cache remains in the server-only
ledger and includes user/project/task scope.

## 31. Deletion and retention behavior

- Soft-deleted projects are hidden from active queries and recoverable for 30 days.
- Archived/completed/paused projects remain in the library but cannot be current focus.
- Permanent deletion sanitizes retained lifecycle/timeline/usage metadata and preserves accounting,
  audit, and XP facts without private project text.
- User deletion cascades founder-owned rows according to existing foreign keys.
- Exact legal retention periods for audit, AI accounting, and analytics are product/legal decisions
  still to be recorded.

## 32. Synthetic-data handling

`opportunity_projects.is_synthetic` is server-controlled because ordinary project update grants omit
it. Synthetic projects must have learning exclusion set; the live check found zero violations.
Learning, founder intelligence, core-loop success, and feedback eligibility already exclude
synthetic projects. AI requests have a synthetic marker for cost/test separation.

## 33. Seed and fixture changes

No production seed was run. `supabase/seed.sql` contains public opportunity fixture data only and no
credentials. Transactional live tests used existing users, generated temporary rows, and rolled back.
A clean, deterministic two-user Auth fixture remains recommended for CI.

## 34. Backup and recovery notes

The connected project is `ACTIVE_HEALTHY`; database version and region were verified. Dashboard
backup schedule and PITR entitlement were not accessible and are not claimed. Before release, verify
daily backups/PITR in Supabase, export the schema, retain migration files, and perform a test restore.
Storage objects require a separate recovery plan from database rows.

## 35. Database observability changes

No sensitive values are logged by the migration. Existing app events, feature usage, audit logs, AI
request IDs, and database logs provide operation/request correlation. A review of recent PostgreSQL
logs showed expected test denials and one corrected ambiguous verification query; no migration
failure remained. Repeated historical `app_events` RLS errors should be monitored to ensure all
deployments use the server admin logger.

## 36. Capacity assessment

- 100 active users: suitable for beta after this patch; monitor generation/evidence errors and
  connection usage.
- 1,000 active users: aggregate dashboard counts, cursor-paginate library evidence/admin history,
  finish RLS init-plan conversion, and load-test project creation/evidence save.
- 10,000 active users: add database-side summaries, analytics retention/partition strategy,
  connection-pool/load budgets, slow-query alerting, and measured query-plan regression tests.

These are engineering gates, not capacity promises.

## 37. Files changed

See the Git diff. Primary files are the two migrations, verification SQL, database/RLS tests,
`lib/database.types.ts`, `app/(app)/generate/actions.ts`, and this audit/runbook.

## 38. Environment changes

No environment variable, package, tool, extension, or external service was added.

## 39. Security impact

Anonymous access to the founder core and creation RPC was removed. Owner/project invariants now
survive service-role bugs. The obsolete public definer helper is no longer authenticated-callable.
RLS behavior is otherwise preserved.

## 40. Performance impact

Core RLS auth checks are initialized once per statement. Ten targeted FK/history indexes improve
deletes and linked-history lookup. Each project-scoped write adds one indexed owner lookup, and
linked evidence/decision writes add bounded primary-key checks; this is an intentional integrity cost.

## 41. Tests run and exact results

- `npm.cmd test`: 42 test files passed, 204 tests passed.
- `npm.cmd run typecheck`: passed with zero TypeScript errors.
- `npm.cmd run lint`: passed with zero errors and 14 pre-existing warnings.
- `npm.cmd run build`: passed; 19 static pages and all application routes built.
- `git diff --check`: passed; line-ending normalization warnings only.
- Live SQL: 20 owner triggers, 3 link triggers, 10 new indexes, 62/62 public tables with RLS,
  one consolidated feature-event read policy, zero unwrapped auth calls in the core policy set,
  and zero owner/focus/idempotency invariant failures.

## 42. RLS test results

Passed transactionally with two existing non-admin users:

- own project read allowed;
- other project read denied;
- other profile read denied;
- cross-project output insert denied;
- anon creation RPC execution denied;
- authenticated creation RPC execution allowed.

## 43. Migration test results

- Existing live schema: both migrations applied successfully.
- Preflight: passed with zero existing mismatches.
- Transactional duplicate project creation: same ID returned; exactly one project, one generation
  history row, one created lifecycle event, and one focus row; transaction rolled back.
- Clean database replay: not run because the repository lacks local Supabase configuration/CLI and
  no paid branch was created without approval.

## 44. Browser verification

The public deployed landing page loaded successfully in Chrome with no browser-console warnings.
The deployment was not signed into PrismForge, so private project screens and the normal-user
release-gating journey could not be exercised without requesting credentials. The deployed
application is also the previous compatible build; the application changes in this audit have not
been committed or deployed.

## 45. Cross-user verification

Database integration verification passed with two normal users. Cross-user browser verification is
still pending because two authenticated browser sessions were not available.

## 46. Core-loop regression result

The full Vitest suite passed (42 files, 204 tests). Database-side creation, idempotency, RLS, admin,
owner, and linked-record invariants passed. The authenticated browser journey remains a deployment
gate.

## 47. Production-build result

`npm.cmd run build` passed. Next.js generated 19 static pages and all application routes. The build
reported the same 14 lint warnings plus existing Edge-runtime and webpack cache warnings; none
failed the build.

## 48. Deployment order

1. Confirm Supabase backup/PITR status.
2. Apply `20260717230826` then `20260717231349` (already applied to the connected project).
3. Run verification SQL and RLS/atomic transaction tests.
4. Deploy the application commit containing the fail-closed RPC path and updated types.
5. Run the normal-user core loop and inspect database/API logs.

The old application remains compatible: its redundant public-helper call is caught, while the
creation RPC already performs lifecycle registration internally.

## 49. Exact rollback or forward-fix procedure

Prefer a forward fix. The migrations are non-destructive and the old app is compatible.

Application rollback: redeploy the previous application commit; no schema rollback is required.

Database emergency forward fix:

1. Disable the affected application mutation.
2. Create a new migration; never edit the applied files.
3. Repair the specific function/policy/trigger.
4. Re-run owner, focus, duplicate, RLS, and atomic-creation verification.
5. Re-enable the mutation and monitor PostgreSQL/API logs.

If enforcement itself must be reverted temporarily, a new reviewed migration may drop the
`enforce_project_owner`/`enforce_validation_links` triggers and restore the prior policies/grants.
Do not drop ledger/history data or the unique idempotency indexes. Reverting enforcement reopens the
original corruption risk and is not the recommended response.

## 50. Remaining risks

- Clean-database migration replay is unverified.
- Normal-user browser/E2E is not yet complete for the new app build.
- Backup/PITR configuration is not verified.
- Supabase Auth leaked-password protection is disabled and should be enabled in the dashboard.
- Remaining legacy RLS init-plan and low-value unindexed-FK advisor notices should be handled by
  measured priority.
- Evidence recommendation/progress reconciliation is retryable rather than one monolithic
  transaction; canonical evidence and timeline remain safe.
- Rate limiting outside the central AI path still fails open when its server primitive is missing.
- Some admin/progress screens aggregate bounded but relatively large row sets in application memory.
- Manual database types do not include generated relationship metadata.

## 51. Production-readiness declaration

Database integrity and RLS corrections are live and verified, and the new application build passes
its local release checks. Full release readiness cannot yet be declared until that build is
committed/deployed, the normal-user browser journey and clean migration replay pass, backup/PITR is
confirmed, and leaked-password protection is enabled or explicitly risk-accepted.
