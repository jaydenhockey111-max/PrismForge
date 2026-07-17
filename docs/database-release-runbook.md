# Database Release and Recovery Runbook

## Before deployment

1. Confirm the Supabase project is healthy.
2. In the Supabase dashboard, confirm the latest automatic backup and whether PITR is enabled.
3. Enable leaked-password protection, or record an explicit security risk acceptance.
4. Export schema/migration metadata and retain it with the release record.
5. Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
6. Run the SQL in `supabase/verification/20260717230826_database_integrity_verification.sql`.
7. Run two-user RLS and transactional atomic-creation tests.

## Deployment order

The two database migrations are additive and already live on the connected project:

1. `20260717230826_database_integrity_hardening.sql`
2. `20260717231349_rls_performance_and_rpc_hardening.sql`
3. Application deployment
4. Non-admin synthetic release-gating journey
5. PostgreSQL/API log review

## Release gate

```text
Sign in
→ Create Project
→ Open Project
→ See Project Summary
→ See Biggest Question
→ Receive Next Best Action
→ Open Action Support
→ Save Evidence
→ See Recommendation Update
```

Verify exactly one project/history/lifecycle/focus row for the request, one evidence row, no duplicate
XP/timeline event, persistence after reload, and zero cross-user visibility.

## Failed application deployment

Redeploy the prior application commit. It is schema-compatible. The prior code's redundant public
lifecycle-helper call may be denied, but that call is caught and the creation RPC now performs the
same work atomically.

## Failed database behavior

Do not edit an applied migration.

1. Disable the affected mutation/feature.
2. Capture request ID, operation, PostgreSQL code, and affected table—never private row content.
3. Check owner/focus/idempotency verification counts.
4. Add a new forward-fix migration.
5. Verify against existing schema and a clean/branch schema.
6. Re-enable and monitor.

## Accidental deletion

1. Stop writes to the affected feature.
2. Identify whether the row is soft-deleted/recoverable or permanently deleted.
3. Confirm backup/PITR recovery point in the dashboard.
4. Restore into an isolated project/branch first.
5. Compare owner, lifecycle, focus, evidence, XP, timeline, and AI ledger counts.
6. Copy only reviewed rows or promote the tested recovery according to the incident plan.

Database backups do not restore Storage objects; recover attachments separately.

## Clean migration verification

The repository currently lacks `supabase/config.toml`. When the Supabase CLI is approved and the
repository is linked:

```powershell
supabase start
supabase db reset
supabase db lint
supabase gen types typescript --local
```

Do not run `db reset` against the remote production project.
