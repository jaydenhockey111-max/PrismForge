# Tier 3A Founder Timeline — Release and Rollback

## What ships

Tier 3A adds one private, append-only `founder_timeline_events` model. Database triggers translate only meaningful records from project lifecycle, founder stages, validation paths, Proof Board completions, decisions, evidence-backed XP, closure reflections, and level changes. Timeline rows reference source records; decision rationale, proof learnings, and XP reasons are joined only when read. No AI service is called.

The global Founder Timeline is `/timeline`. Each project has `/projects/{id}/timeline`. Both use indexed, keyset pagination, deterministic search, category filters, and the same canonical data.

## Required migration order

Do not deploy the Tier 3A application before these are confirmed in Supabase:

1. `20260712000013_flexible_validation_paths.sql`
2. `20260712000014_project_lifecycle.sql`
3. Run `20260712000015_founder_timeline_preflight.sql` and save the counts.
4. Confirm a current Supabase backup or point-in-time recovery.
5. Run `20260712000015_founder_timeline.sql`.
6. Run `20260712000015_founder_timeline_verification.sql`. Every assertion must pass.

## Local gate

From the repository root:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The permanent Create Project funnel test must remain green. Do not deploy if any command fails.

## Required deployed non-admin journey

Use a normal founder account, not the admin account:

1. Create a uniquely named project and retain the Create Project request ID.
2. Confirm exactly one project opens and the Create Project funnel reaches `project_creation_completed`.
3. Open Founder Timeline. Confirm exactly one `Project created` event and no page-open or AI-generation events.
4. Start a validation path, save and complete a Proof Board experiment, and record a decision with Before, After, Why, and Evidence.
5. Confirm the project timeline shows only that project's events and Founder Timeline shows it among all projects.
6. Confirm the decision expands to the correct source-backed context and XP shows the reason it was earned.
7. Search by project name and decision text; filter Validation and Decisions; load the next page if available.
8. Pause, resume, complete, archive, and restore as applicable. Each successful transition must appear exactly once.
9. Sign in as a second normal account and direct-link the first account's project and timeline. Both must return no private data.
10. Test at phone width and desktop width. Review browser console, Vercel logs, and Supabase logs for the request ID.

## Post-deployment synthetic Create Project test

Immediately after production promotion, repeat steps 1–3 with the dedicated synthetic founder account. A release is not accepted until the generated project opens, its next action loads, and its single canonical creation event appears.

## One-command application rollback

The last recorded verified pre-Tier-3A candidate is:

- Deployment: `dpl_BBQ8dZaV3BBwZxRzhqgmsuP378KU`
- URL: `https://questmint-3uqd49p6i-opportunityhunter.vercel.app`

Rollback from the repository directory:

```powershell
npx vercel promote https://questmint-3uqd49p6i-opportunityhunter.vercel.app
```

Migration 15 is additive. Prefer leaving it in place during an application rollback so founder history is not destroyed. If the timeline must be disabled, revoke authenticated execution of `search_founder_timeline` and roll back the application; do not drop the event table. Re-enable only after the incident is understood.

## Release gate

Local typecheck, unit tests, and build are necessary but not sufficient. Tier 3A is not production-ready until migrations 13–15 pass, the deployed non-admin journey passes, cross-user isolation is verified, and the post-deployment synthetic Create Project test succeeds.
