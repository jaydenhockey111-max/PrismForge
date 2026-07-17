# Tier 3C Release and Rollback

## Architecture

Tier 3C adds three additive tables:

1. `founder_guidance_preferences`: founder-controlled settings.
2. `founder_intelligence_profiles`: compact cached derived state; no raw project text.
3. `founder_guidance_preference_events`: append-only request-ID history for idempotency and auditability.

The deterministic engine reads normalized Tier 3B snapshots and active pattern references. Current project context is evaluated separately and remains first in every recommendation.

## Guidance behavior

- Guided: fewer alternatives, founder-selected detailed structure remains available.
- Balanced: default presentation and up to two alternatives.
- Autonomous: all valid validation alternatives remain visible.
- Brief, Standard, and Detailed reuse the same underlying recommendation; no duplicate AI output is generated.
- Light, Standard, and Ambitious select two, three, or four weekly quests. XP policy is unchanged.

## Model routing and cost

`lib/founder-intelligence/modelRouting.ts` classifies deterministic, frequent creative, strategic, and rare deep-review work. Tier 3C performs only deterministic work automatically. Existing server-authoritative AI plan limits, cooldowns, caching, and successful-use accounting are unchanged. The optional deep-review route is architecture-only and has no UI.

AI Team context is capped at explicit preferences, declared constraints, two relevant pattern summaries, and one caveat. Full history is never sent. This slightly increases an explicit AI Team prompt but adds zero background API cost.

## Cache and invalidation

- Derived profiles are reused for 15 minutes when ready and unchanged.
- Tier 3B learning-version changes mark Tier 3C dirty.
- Preference changes and resets mark Tier 3C dirty.
- Tier 3B already invalidates learning when project evidence, decisions, lifecycle, exclusions, or deletion changes.
- A two-minute calculation lease prevents duplicate recalculation work.
- Deleted or synthetic sources are superseded in Tier 3B before they can be selected by Tier 3C.

## Deployment gate

Do not deploy until a normal authenticated non-admin account passes:

1. Sign in.
2. Open Settings and load preferences.
3. Switch guidance mode and confirm persistence.
4. Disable historical personalization and confirm reminders disappear.
5. Create a project.
6. Confirm it appears in Projects and Current Focus.
7. Open Today and receive Next Best Action.
8. Save Proof Board evidence.
9. Confirm Timeline, Progress, Cross-Project Learning, and Founder Intelligence still load.
10. Confirm no automatic OpenAI usage event was created.

After deployment, repeat with a synthetic normal-user project and exclude it from learning.

## One-command application rollback

Last known-good production deployment before Tier 3C:

```powershell
npx vercel promote https://questmint-jyiaq0a0q-opportunityhunter.vercel.app
```

Deployment ID: `dpl_VALXw2gJRVHjUT3n5GDr1mGQV2dL`.

## Database rollback implications

The migration is additive. During an application rollback:

1. Promote the last known-good Vercel deployment.
2. Leave all Tier 3C tables and functions in place so user preferences and audit history are preserved.
3. If emergency isolation is required, revoke authenticated `SELECT` on the three Tier 3C tables and `EXECUTE` on the two founder mutation RPCs. Do not drop tables.
4. Mark cached profiles dirty before re-enabling Tier 3C.
5. Re-run the authenticated journey and RLS verification.

No older application route depends on Tier 3C, so the additive schema is backward compatible.

## Verification references

- Migration: `supabase/migrations/20260712000017_founder_intelligence.sql`
- SQL verification: `supabase/verification/20260712000017_founder_intelligence_verification.sql`
- Pure engine tests: `lib/founder-intelligence/engine.test.ts`
- Migration tests: `lib/founder-intelligence/migration.test.ts`
- Model-routing tests: `lib/founder-intelligence/modelRouting.test.ts`

