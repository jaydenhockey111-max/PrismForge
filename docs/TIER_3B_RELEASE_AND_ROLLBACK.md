# Tier 3B Cross-Project Learning — Release and Rollback

## Architecture

Tier 3B uses no model for routine learning. Meaningful source records mark `founder_learning_state` dirty. The next Progress visit claims a two-minute-safe calculation lease, loads compact structured columns, builds deterministic comparable-project summaries and conservative pattern candidates, then publishes a cached insight set. Publication is database-atomic: stale active patterns are superseded and the completed pending set becomes active together.

`founder_pattern_insight_sources` provides project and record provenance. Corrections and exclusions are append-only in `founder_pattern_feedback`; an unchanged dismissed or corrected fingerprint is not republished. Soft-deleted, permanently deleted, founder-excluded, and synthetic projects immediately supersede active patterns that reference them.

## Evidence tiers

- **Early indication:** at least two comparable projects but limited support or mixed history.
- **Repeated pattern:** at least three comparable projects and at least two supporting projects.
- **Strong personal pattern:** at least five comparable projects, at least four supporting projects, and no more than one contradicting project.

These are sample-quality descriptions, not probabilities. Every insight shows supporting projects, contradicting projects, and limitations.

## Model routing foundation

- **No model:** counts, durations, eligibility, evidence tiers, provenance, search, feedback, deletion handling, and routine insight generation.
- **Lower-cost model, future only:** explicit concise wording or retrospective formatting from the compact deterministic snapshot.
- **Strong model, future only:** explicit deep review of contradictory evidence or a major founder retrospective.

Tier 3B deliberately ships without optional AI synthesis. API-cost impact is zero. Any future synthesis must be one explicit, cached, token-capped call and may not create unsupported insights.

## Migration order

1. Confirm migrations through `20260712000015_founder_timeline.sql` are applied.
2. Run `20260712000016_cross_project_learning_preflight.sql` and save the counts.
3. Confirm Supabase backup or point-in-time recovery.
4. Run `20260712000016_cross_project_learning.sql`.
5. Run `20260712000016_cross_project_learning_verification.sql`; every assertion must pass.
6. Open Progress once with a normal account to perform the first deterministic calculation.
7. Run the verification SQL again so active-source and exclusion assertions cover calculated data.

## Local release gate

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Required deployed non-admin test

1. Sign in as a normal founder and create a uniquely named project.
2. Confirm the project opens, appears in Project Library, and becomes Current Focus.
3. Confirm Next Best Action and the active validation path load without an automatic OpenAI call.
4. Save Proof Board evidence and verify the project and Founder Timeline remain correct.
5. Open Progress → Across Your Projects. Verify insufficient-data wording for fewer than two eligible projects, or source-linked patterns for sufficient history.
6. Search and filter insights; open supporting and contradicting projects.
7. Mark an insight useful, dismiss another, correct another, and exclude one source project. Confirm no XP is awarded and unchanged dismissed/corrected insights remain hidden.
8. Mark a dedicated test project synthetic using its project learning preference. Confirm it becomes ineligible and cannot support an active pattern.
9. Soft-delete a sourced project and confirm its active insight is superseded immediately. Restore it and confirm it can reenter only after recalculation.
10. Sign in as normal account B and request account A insight/source/project IDs. All must return no private data.
11. Test Progress and project reminders at phone and desktop widths, with keyboard navigation and long text.
12. Review Vercel and Supabase logs using Create Project and feedback request IDs.

## Post-deployment synthetic test

Repeat Create Project → Open Project → Next Best Action → Save Evidence using the dedicated normal synthetic account. Mark the project synthetic immediately and confirm no false pattern appears. This is required after production promotion.

## Exact rollback

Latest production deployment observed before Tier 3B implementation:

- Deployment: `dpl_VALXw2gJRVHjUT3n5GDr1mGQV2dL`
- URL: `https://questmint-jyiaq0a0q-opportunityhunter.vercel.app`
- State: `READY`

One-command application rollback:

```powershell
npx vercel promote https://questmint-jyiaq0a0q-opportunityhunter.vercel.app
```

Migration 16 is additive. Prefer leaving its tables in place during application rollback. To disable reads without destroying founder feedback or provenance, temporarily revoke authenticated `SELECT` on the five Tier 3B tables and roll back the app. Do not drop cached insights until deletion/privacy verification is complete. After rollback, retest sign-in, Create Project, Project Library, Current Focus, Next Best Action, Proof Board, Founder Timeline, and Progress.

## Production declaration

Local tests and build are insufficient. Tier 3B must not be called production-ready until migration verification, the deployed normal non-admin journey, cross-user isolation, deleted-project privacy, and the post-deployment synthetic test all pass.
