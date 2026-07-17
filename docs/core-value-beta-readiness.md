# PrismForge Core-Value Beta Readiness

Updated: July 16, 2026

## Beta promise

PrismForge helps a first-time founder turn a vague idea into one clearly labeled assumption, one realistic test, the support needed to run that test, and a place to record evidence. Saved evidence can change the recommended next action, and the product explains that change without claiming that an untested idea is validated.

The controlled-beta success criterion is five new founders completing this loop, with at least three reporting that PrismForge helped them reach a useful action or decision faster than they would have alone.

## Primary product path

1. Create a project from founder-written context.
2. Read the project summary and the **Biggest Question to Test**.
3. Start the single **Next Best Action**. Every action includes why it matters, estimated effort, a completion condition, evidence to record, execution support, and what happens next.
4. Use the deterministic support path for customer discovery, private research, prototype testing, landing-page testing, pricing testing, or a service pilot.
5. Save real-world evidence in Proof Board.
6. Review the updated assumption status and next recommendation.
7. Optionally answer the core-value feedback prompt.

Today is the action screen, Project is the context screen, Validate is the evidence screen, and Progress is the milestone screen. Advanced planning, XP, timeline, specialist, and cross-project systems remain available but are collapsed or visually secondary.

## Deterministic state and source of truth

- Projects remain in `opportunity_projects`.
- The primary unproven question is persisted in `project_assumptions` and can be edited without replacing strong founder language.
- Real-world evidence is persisted in `project_validation_experiments`.
- Validation path history remains in `validation_paths` and `validation_path_events`.
- Core-loop behavior is recorded through the existing `app_events` system. No duplicate analytics table was added.
- A core-loop completion requires saved evidence plus a changed recommendation. Page views alone cannot complete the loop.
- Synthetic/test projects are excluded from genuine completion and return-success counts.

## Analytics events

The core funnel is:

`core_loop_project_created` → `core_loop_summary_viewed` → `core_loop_assumption_viewed` → `core_loop_next_action_viewed` → `core_loop_next_action_started` → `core_loop_support_opened` / `core_loop_support_generated` → `core_loop_evidence_started` → `core_loop_evidence_saved` → `core_loop_recommendation_updated` → `core_loop_completed` → return and feedback events.

Additional measurements include next-day and seven-day return, second-project creation, repeated specialist use, error views, feedback, payment signals, and optional case-study contact permission. Event timestamps support duration analysis between funnel steps. Request IDs support retry and duplicate analysis.

Analytics is best effort and must never block project creation, evidence entry, navigation, or feedback. Metadata is intentionally compact; API keys, passwords, full project reports, and unnecessary personal content must never be logged.

## Beta diagnostics

The admin monitoring page should be checked daily for:

- unique founders reaching each core-loop funnel stage;
- evidence saved versus recommendation updates;
- completed loops and return events;
- error categories and repeated request IDs;
- optional core-value feedback;
- synthetic versus genuine projects;
- payment-signal events without assuming purchase intent.

For a five-user beta, review individual failures only through the minimum safe metadata already captured. Do not copy project content into case studies without explicit permission.

## Database security status

Migration `20260716000018_core_value_beta_hardening.sql` is applied to the production Supabase project.

It pins safe search paths and removes anonymous/authenticated direct execution from internal rate-limit, user-creation, and trigger helper functions. `is_admin()` remains callable by authenticated users because ownership-aware RLS policies depend on it; it returns authorization state rather than privileged data. Other authenticated `SECURITY DEFINER` RPCs must retain their user/ownership checks and should be reviewed whenever edited.

`rate_limit_buckets` intentionally has RLS with no client policy because it is an internal service-role table. Supabase's leaked-password protection remains a manual Auth-dashboard setting and should be enabled before a public launch.

Reference: [Supabase leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Five-user beta procedure

1. Use five fresh, non-admin accounts. Do not count the founder/admin account.
2. Ask each tester to use a real idea or a realistic idea they understand. Include at least one software idea and one simple service business.
3. Give only this task: “Use PrismForge to decide what you should test next, begin the test, and record what happened.” Do not coach the interface unless they are blocked.
4. Observe whether they can create a project, identify the biggest question, understand the next action, open the right support, and save evidence.
5. After evidence is saved, verify that the assumption status or recommendation visibly changes and that the reason is understandable.
6. Ask the in-product core-value question only after evidence exists. Then ask what was useful, confusing, generic, unsupported, or slower than doing it alone.
7. Record whether the user returns the next day or within seven days and whether they start a second genuine project.
8. At the end of five sessions, calculate completion rate and the number who report a faster useful decision/action. The milestone passes only at three of five or better.

## Manual release gate

Before deployment, a normal authenticated non-admin account must complete this exact production-like journey:

1. Sign in.
2. Create a project.
3. Open Today and Project.
4. Confirm the Biggest Question is editable and remains after refresh.
5. Start the Next Best Action and open its support.
6. Save evidence in Validate.
7. Confirm the assumption status/recommendation changes without a manual page reload.
8. Confirm the feedback prompt appears only after evidence and respects its cooldown.
9. Sign out and sign back in; confirm project, evidence, and guidance persist.
10. Confirm the user cannot open `/admin` or another user's project.

If any step fails, do not deploy. Public pages, redirects, unit tests, and a successful build are necessary but do not replace this authenticated gate.

## Rollback

Last known-good production deployment at the time of this pass:

```powershell
npx vercel promote https://questmint-jyiaq0a0q-opportunityhunter.vercel.app
```

After promoting, verify landing, sign-in, project creation, project ownership, evidence save, and admin denial for a normal account. The database hardening migration can remain in place during an app rollback because it does not change user data or application table shape; it only narrows function permissions and fixes search paths. Re-granting anonymous execution is not a safe rollback strategy.

If core-loop analytics must be paused, remove only the new event calls in an app rollback. Existing event rows can remain because they are append-only diagnostics and do not alter user guidance. If beta focus mode must be backed out, restore the previous UI deployment; do not delete assumptions, experiments, or evidence.

## Current release decision

The code, 182 deterministic tests, production build, public desktop page, 375-pixel mobile layout, authentication redirect, Supabase function hardening, and production dependency audit have been verified. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities. Deployment remains blocked until the authenticated non-admin manual release gate above is completed with a real beta account.
