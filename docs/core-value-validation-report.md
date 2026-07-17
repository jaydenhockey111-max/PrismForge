# PrismForge Core Value Validation Report

Date: July 17, 2026

## Release decision

**Not production-ready yet.** The repository remediation, live additive migration, automated gates, public responsive browser checks, and targeted RLS isolation probe pass. The mandatory deployed normal non-admin end-to-end journey and post-deployment synthetic journey have not been run because no dedicated authenticated beta-test session was available. Those are critical release gates and remain blocking.

## 1. First-time-user audit

The production landing page and authentication boundary were rendered in the in-app browser at desktop and mobile sizes. The public path clearly states the outcome, shows a concrete founder loop, and routes unauthenticated project access to sign-in. Repository and deterministic fixture review covered student software, service, physical product, marketplace, creator, and blank-idea generation.

The required authenticated Project A-D creation sessions were not run. A dedicated normal non-admin account is still required to measure real creation latency, inspect generated sentences, and complete the deployed evidence loop without using the sole admin account.

## 2. Rendered UX problems found

- Public Sentry example page and API routes were still deployed and caused the only recent production 500 logs.
- Client analytics writes used a founder-scoped client against an admin-only event table, ignored the insert error, and returned HTTP 200 on exceptions.
- The Biggest Question view was recorded twice: once server-side and once client-side.
- The feedback prompt appeared after any experiment, including planned evidence that had not changed guidance.
- Feedback cooldown depended only on local storage and could repeat in another browser.
- Optional founder prose was copied into analytics metadata.
- Research contact permission existed only as an event, not as a founder-owned permission record.
- Lint was configured with the removed `next lint` command and could not run.
- The local Sentry release upload cannot reach Sentry from the restricted sandbox; the application build still completes.

## 3. Core-loop architecture

`opportunity_projects` owns the project, `project_assumptions` owns the editable Biggest Question, `validation_paths` owns deterministic routing, `project_validation_experiments` owns evidence, and `app_events` records privacy-safe behavior. Evidence guidance updates compare route fingerprints before and after evidence; completion is recorded only when guidance changes and the project is not synthetic.

## 4. First-session success contract

`lib/founder-os/coreLoop.ts` derives project-specific progress from server records and events. Views alone cannot complete the loop. Completion requires evidence plus a changed recommendation, is idempotent, awards no XP, and excludes synthetic projects from real beta completion.

## 5. Positioning changes

Verified outcome-first public copy: “Know exactly what to test next,” followed by a concise assumption → test → evidence explanation. “AI Founder Operating System” remains secondary rather than acting as the only explanation. No guaranteed validation, revenue, or product-market-fit claim is present.

## 6. Onboarding changes

Verified existing first-time-founder examples and constraint fields while preserving routing for services, marketplaces, creators, local businesses, physical products, courses, and communities. No new top-level navigation or automatic AI call was added.

## 7. Today simplification

Today leads with the Biggest Question and one Next Best Action. The daily quest is supporting content; weekly planning and specialists sit behind “More planning tools.” XP, rewards, timeline, and cross-project learning do not compete with the primary action.

## 8. Project simplification

Project answers what is being built, for whom, the problem, smallest MVP, fastest validation, constraints, stage, and decisions. The core question remains editable and founder wording is preserved when stronger.

## 9. Validate simplification

Validate is routed around the active Validation Path, one assumption, one action, required evidence, relevant support, and Proof Board. Routing varies for discovery, private research, prototype, waitlist, pricing, service pilot, marketplace supply/demand, and post-launch learning.

## 10. Progress simplification

Value Proof and meaningful project state remain primary. Timeline, patterns, XP, quests, rewards, and advanced history are secondary or hidden when empty.

## 11. Advanced-feature de-emphasis

Advanced systems remain intact and accessible. They are collapsed, placed below core content, or omitted when there is no relevant data. No separate simplified application was created.

## 12. Biggest Question implementation

Every active project receives one deterministic assumption derived from context, evidence, and the active path. It is labeled as unproven, editable, linked to evidence and the Next Best Action, and has no decorative confidence score.

## 13. Next Best Action improvements

The action model includes what to do, why it matters, done-when criteria, evidence to record, effort, support route, and what happens next. Founder time, budget, technical ability, stage, project type, preferences, and existing evidence affect the route.

## 14. Action-support mapping

Deterministic support maps customer discovery, private research, prototype, landing-page/waitlist, pricing, service pilot, marketplace, and post-launch work to the relevant material and evidence form. AI remains explicit and task-routed only where generated material adds value.

## 15. Evidence-to-guidance behavior

Saving evidence updates the linked assumption, recomputes the validation route, and records `core_loop_recommendation_updated` only when the before/after recommendation fingerprint differs. The project shows what the latest evidence changed.

## 16. Strong-input preservation

Title, context, and output-quality policies retain strong founder language instead of overwriting it with weaker generated copy.

## 17. Regurgitation detection

Exact and reordered repetition, prompt leakage, and weak restatement fixtures are covered by the existing output-quality and trust tests. Fallbacks are used when generated output adds no material value.

## 18. Grammar and logic safeguards

Grammar, punctuation, title, placeholder, unsupported-claim, business-type leakage, and logical-consistency fixtures pass in the 189-test suite.

## 19. Text-density reduction

The primary screens use concise headers, one dominant action, and progressive disclosure for planning and advanced systems. The public page has no clipped core copy at the tested breakpoints.

## 20. Score changes

No decorative score was added to the core loop or Biggest Question. Evidence counts and status labels remain deterministic; advanced internal monitoring scores do not appear in the founder’s primary flow.

## 21. Beta Focus Mode

No separate flag platform or application mode was added. The focused presentation is state-aware within the existing screens.

## 22. Core-loop analytics

The structured creation funnel remains intact. Core-loop view, start, support, evidence, recommendation, completion, return, second-project, reuse, feedback, and error events remain. Client events now authenticate and verify project ownership, persist through the service role only after authorization, return truthful status codes, and include request IDs.

## 23. Friction instrumentation

Existing abandonment, duplicate submission, repeated quest completion, retries/failures, error views, replacement, search/switching, and generation-not-saved signals remain. The quest-view callback is now stable so the session guard records the event once.

## 24. Feedback prompts

The prompt now appears only after a real recommendation-update event, never for synthetic projects, and only when no submitted response or active founder-owned cooldown exists. It captures Yes/Somewhat/No, optional updated-recommendation usefulness, and optional private explanation. “Not now” creates a server-owned 30-day cooldown across browsers. Errors show a request ID.

## 25. Cohort handling

`new_core_loop_beta`, prior-version, student-founder, software/service, and synthetic tags are deterministic and non-sensitive. Synthetic projects are excluded from completion and return-success metrics.

## 26. Return-session improvements

Current focus, recent evidence, changed assumption/recommendation, and one Next Best Action lead the return experience. Next-day and seven-day events exclude synthetic projects.

## 27. Payment-signal instrumentation

Billing/pricing views, project export, second project, specialist reuse, repeated evidence/actions, limits, premium attempts, and closure can be measured without a purchase-likelihood score. One pricing view is not treated as intent.

## 28. Case-study permission foundation

Permission is offered only after a Yes rating and an existing real decision. It stores user, project, milestone, contact preference, permission, and timestamp in the private feedback row. No private project content is copied to marketing or analytics.

## 29. Admin diagnostics

The server-authorized admin monitoring page shows core funnel, evidence/recommendation, completion, return, feedback, failures, and cohort filtering. The only admin email remains server-authorized; no client metadata grants admin access.

## 30. Loading and error improvements

Create, evidence, support, and feedback actions disable while pending and preserve input. Feedback no longer silently succeeds on database failure; failures return non-2xx status and a request ID. Debug routes were removed.

## 31. AI usage impact

No automatic OpenAI call was added. Routing, status, evidence counts, quests, XP, analytics, feedback eligibility, and completion remain deterministic.

## 32. API-cost impact

No new model task or token use was introduced. The new work adds small database queries/writes only after authenticated founder actions.

## 33. Performance impact

Feedback eligibility uses one owner-scoped row lookup and one compact event existence lookup in parallel with project data. The client API performs a compact ownership check. Project detail remains the heaviest route at 73.6 kB route JavaScript and 317 kB first-load JavaScript; this is a remaining optimization target.

## 34. Files changed

- `app/(app)/projects/[id]/page.tsx`
- `app/api/beta-events/route.ts`
- `components/founder-os/core-loop-experience.tsx`
- `components/founder-os/quest-system.tsx`
- `lib/analytics/clientEventPolicy.ts`
- `lib/analytics/clientEventPolicy.test.ts`
- `lib/database.types.ts`
- `lib/founder-os/coreValueFeedbackMigration.test.ts`
- `supabase/migrations/20260717165714_core_value_feedback.sql`
- `supabase/migrations/20260717182804_core_value_feedback_cooldown.sql`
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`
- `docs/core-value-beta-readiness.md`
- `docs/core-value-validation-report.md`
- Removed `app/api/sentry-example-api/route.ts`
- Removed `app/sentry-example-page/page.tsx`

## 35. Schema and migration changes

Applied live migrations `core_value_feedback` (`20260717170738` in Supabase; repository file `20260717165714_core_value_feedback.sql`) and `core_value_feedback_cooldown` (`20260717182921` in Supabase; repository file `20260717182804_core_value_feedback_cooldown.sql`). The table is additive, transactional, project-linked, idempotent per user/project and user/request ID, and safe to retain through app rollback.

## 36. RLS and security changes

RLS is enabled with three owner/project policies for `SELECT`, `INSERT`, and `UPDATE`. Authenticated users receive only those table grants. A rolled-back live probe authenticated as a different user returned zero rows. The API never accepts a client user ID and creates the admin client only after authentication and project authorization. The production dependency audit found zero vulnerabilities.

## 37. Browser verification

Rendered the local production build with the production environment, inspected semantic DOM and layout metrics, tested protected-route redirection, verified the removed debug page returns 404, and reviewed local runtime stderr. Public production was also inspected before remediation; its recent 500s were confined to the now-removed Sentry example API.

## 38. Screens and breakpoints

- Landing: 375 × 812, 390 × 844, 768 × 1024, 1440 × 900
- Sign-in redirect from `/projects`
- Branded 404 at `/sentry-example-page`

All tested public widths had equal document/client width, no clipped core text, a visible primary CTA, and no small primary action target. The browser controller enforces a 375-pixel minimum, so 320 pixels was not separately rendered.

## 39. Tests and exact results

- `npm run typecheck`: passed
- `npm run lint`: passed, 0 errors and 16 legacy warnings after the quest-hook fix
- `npm test`: 38 files passed, 189 tests passed
- `npm run build`: passed; 19 static pages generated
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- `git diff --check`: passed
- Supabase migration: applied successfully
- New-table live verification: RLS true; policies `INSERT`, `SELECT`, `UPDATE`; cross-user visible rows `0`

The restricted local environment could not upload Sentry releases/source maps, but that upload failure was non-fatal and the production compiler exited successfully.

## 40. Release Safety Verification

| Gate | Status | Evidence |
|---|---|---|
| End-to-end core loop | **Failed** | Mandatory deployed authenticated journey not run |
| Normal non-admin journey | **Failed** | No dedicated signed-in beta session available |
| Project creation | **Passed** | Creation regression and funnel tests pass; deployed manual gate still required |
| Project summary | **Passed** | Deterministic/render structure verified |
| Biggest Question | **Passed** | Editable, unproven, linked, and tested |
| Next Best Action | **Passed** | Complete action contract and routing fixtures pass |
| Action support | **Passed** | Path/support mapping and navigation verified in code/tests |
| Evidence recording | **Passed** | Proof actions and regression tests pass |
| Recommendation update | **Passed** | Before/after fingerprint logic and tests pass |
| Advanced-feature de-emphasis | **Passed** | Primary screens use progressive disclosure |
| Mobile journey | **Failed** | Public mobile passes; authenticated full loop not run |
| Cross-user isolation | **Passed** | Live rolled-back RLS probe returned zero rows |
| Automatic OpenAI calls added | **No** | No page-load or automatic model path added |
| Core-loop analytics | **Changed** | Existing funnel preserved; client persistence/privacy fixed |
| Request-ID monitoring | **Changed** | Feedback/client-event failures now return request IDs |
| Post-deployment synthetic test | **Not run** | New app code is not deployed and no dedicated test account was available |

Rollback command:

```powershell
npx vercel promote https://questmint-5llmwa5kr-opportunityhunter.vercel.app
```

Last known-good deployment: `dpl_5gkq6Db2CjARcJmH9864H84cFLhU`, commit `caacd973d7c9726a2508ffb6d5b4bf1cfa0074f3`.

Database rollback implications: leave both additive migrations in place. Older app code ignores `core_value_feedback`; dropping it would destroy feedback and permission records. Existing analytics rows are diagnostic and can remain.

## 41. Remaining risks

- The critical deployed normal-user and synthetic end-to-end gates remain unexecuted.
- Supabase leaked-password protection remains disabled and should be enabled before public launch.
- Supabase reports existing `SECURITY DEFINER` review warnings; the functions are intentional authenticated RPCs but should remain on the security review list.
- The project detail first-load bundle is 317 kB.
- Next/Supabase emits an Edge Runtime `process.version` compatibility warning.
- Sixteen legacy lint warnings remain outside this focused remediation.
- Sentry release/source-map upload could not be verified from the restricted local network.

## 42. Recommended five-user beta procedure

1. Deploy to a preview and run the complete journey with a fresh normal account.
2. Mark the dedicated test project synthetic and confirm it is excluded from completion, returns, learning, and patterns.
3. Promote only after project creation, support, evidence, recommendation change, feedback, admin denial, and cross-user denial pass.
4. Invite five fresh non-admin founders, including at least one software idea, one service, and one non-software idea.
5. Give only the goal: decide what to test next, begin it, and record what happened.
6. Record time-to-project, time-to-action, action start, evidence save, recommendation update, errors, and returns.
7. Ask the in-product value question only after the recommendation changes.
8. Review aggregate admin diagnostics daily; inspect only minimum privacy-safe metadata.
9. Stop and fix any ownership, silent-save, unsupported-claim, or repeated-prompt issue immediately.
10. Pass the milestone only if all five complete the core loop and at least three report a useful action or decision they reached faster than alone.
