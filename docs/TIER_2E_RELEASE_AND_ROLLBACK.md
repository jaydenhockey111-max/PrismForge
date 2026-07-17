# Tier 2E Release and Rollback

## Existing architecture audit

Before Tier 2E, `opportunity_projects.status` represented founder stage (`idea`, `validating`, `building`, `launched`). There was no separate lifecycle state or current-focus record. `/projects` guessed a “Resume project” from `updated_at`; its archived filter returned no records. Dashboard and Progress also selected the most recently updated project. The owner-scoped RLS policies were sound, but authenticated users had direct table delete permission and the Project page performed an immediate hard delete. Evidence, outputs, decisions, validation paths, closure reflections, quests, and XP already carried project IDs.

## Final model

- `opportunity_projects.status`: founder journey stage; unchanged.
- `opportunity_projects.lifecycle_status`: active, paused, completed, archived, or abandoned.
- `opportunity_projects.deleted_at` plus `recovery_expires_at`: 30-day soft-deletion recovery.
- `founder_project_focus`: one canonical current-focus project per founder.
- `project_lifecycle_events`: append-only, privacy-safe lifecycle history.
- `lifecycle_version`: optimistic concurrency guard for multiple browser tabs.
- `last_meaningful_activity_at`: updated by project edits, proof, decisions, validation-path changes, stage changes, closure reflections, verified XP sources, and lifecycle changes—not page views.

Lifecycle and focus RPCs validate `auth.uid()`, ownership, current state, version, and title confirmation. They award no XP and call no AI services.

## Data policy

Soft deletion preserves all project data for recovery. Permanent deletion removes the project report, generation history, evidence, experiments, outputs, assumptions, decisions, validation paths, and closure reflection. XP totals and sanitized XP ledger categories remain; the project foreign key becomes null and private XP metadata is removed. Privacy-safe aggregate analytics and sanitized lifecycle categories may remain for reliability and abuse monitoring.

## Release order

1. Confirm migrations 12 and 13 are already applied.
2. Run `supabase/verification/20260712000014_project_lifecycle_preflight.sql` and save the counts.
3. Back up Supabase or confirm point-in-time recovery.
4. Run `supabase/migrations/20260712000014_project_lifecycle.sql`.
5. Run `supabase/verification/20260712000014_project_lifecycle_verification.sql`. Project, evidence, XP, quest, and reflection counts must match the preflight counts. Invalid focus and orphan counts must be zero.
6. Run `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.
7. Deploy with `npx vercel --prod` only after local checks pass.
8. Run the normal non-admin smoke test below against the deployed URL.

## Required deployed smoke test

Using a dedicated non-admin account:

1. Sign in and create one uniquely named project.
2. Confirm exactly one project is saved, appears in Project Library, and becomes Current Focus.
3. Resume it and confirm `/projects/{id}?section=today` opens with the correct Next Best Action, validation path, and quest.
4. Save one Proof Board experiment and confirm it remains attached to that project.
5. Create or open a second project, switch focus, and confirm the first project remains active while its evidence and quests do not appear in the second project.
6. Pause the focused project and confirm focus moves only when necessary; resume it and confirm its stage is unchanged.
7. Save a closure reflection, complete the project, restore it, and confirm history remains.
8. Move the synthetic project to recovery, restore it, then move it to recovery again. Do not permanently delete evidence needed for test diagnosis until logs are reviewed.
9. Attempt a direct link from a second normal account. It must return the safe not-found experience.
10. Review browser console, Vercel logs, and Supabase logs for uncaught errors using the creation/lifecycle request IDs.

## One-command application rollback

From the project directory, list deployments:

```powershell
npx vercel ls
```

Promote the last verified deployment:

```powershell
npx vercel promote https://questmint-3uqd49p6i-opportunityhunter.vercel.app
```

Pre-Tier-2E production reference recorded on July 12, 2026: deployment `dpl_BBQ8dZaV3BBwZxRzhqgmsuP378KU`, URL `https://questmint-3uqd49p6i-opportunityhunter.vercel.app`, state `READY`. Treat it as the rollback candidate unless a newer deployment is explicitly smoke-tested and approved.

The migration is additive and backward-compatible, so application rollback does not require dropping lifecycle columns. After promotion, verify sign-in, Create Project, project opening, Next Best Action, and evidence saving.

## Database rollback implications

Prefer leaving migration 14 in place during an application rollback. Dropping its columns or tables would destroy lifecycle and recovery history. If a lifecycle RPC is unsafe, revoke its authenticated execute permission temporarily and roll back the application; do not delete tables. Soft-deleted projects remain restorable because older application code will not automatically show them. Any manual restoration must clear both `deleted_at` and `recovery_expires_at` and must be reviewed for current-focus consistency.

## Release gate

Local typecheck/tests/build are necessary but insufficient. Tier 2E must not be called production-ready until the deployed non-admin creation, focus, resume, evidence, pause/restore, deletion/recovery, and cross-user tests pass.
