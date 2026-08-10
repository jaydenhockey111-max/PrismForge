\# PrismForge — Codex Instructions



\## Product



PrismForge helps founders always know their next move.



Core loop:



Context + Evidence → Next Move → Action → Outcome → Learning → Better Next Move



Keep the founder experience simpler than the system underneath it. Prioritize useful founder progress over feature count, dashboards, gamification, or generic AI output.



\## Engineering



\- Inspect the relevant existing implementation before changing it.

\- Prefer the smallest coherent change that fully solves the task.

\- Reuse existing components, utilities, schemas, and patterns before creating new abstractions.

\- Do not refactor unrelated code or implement adjacent features unless requested.

\- Preserve existing architecture unless a change is necessary and justified.

\- Search narrowly first; expand repository exploration only when necessary.

\- Do not repeatedly reread unchanged files.

\- Keep new dependencies to a minimum.



\## Product Integrity



\- Never fabricate evidence, research, metrics, validation results, or product capabilities.

\- Distinguish assumptions, AI inference, external research, and recorded evidence.

\- Prefer honest uncertainty over invented confidence.

\- AI should help founders take useful actions rather than produce generic AI output.

\- Preserve relevant founder/project context across the core loop.

\- Keep founder-facing language concise, specific, and natural.



\## Safety \& Data



\- Preserve existing user data and backwards compatibility where practical.

\- Preserve authentication, authorization, ownership checks, and RLS.

\- Never run destructive database operations without explicit authorization.

\- Prefer additive, backwards-compatible migrations.

\- Never deploy production unless explicitly requested.

\- Never expose secrets or private project data.

\- Preserve analytics, request IDs, error monitoring, exports, lifecycle behavior, and rollback capability when relevant.



\## UI



\- Preserve accessibility, keyboard usability, responsive behavior, and reduced-motion preferences.

\- Treat mobile as first-class.

\- Prefer progressive disclosure over dense interfaces.

\- Avoid unnecessary visual noise, animation, gamification, and decorative complexity.

\- Do not redesign unrelated UI during scoped work.



\## AI \& Cost



\- Prefer deterministic logic when it reliably solves the task.

\- Use the cheapest model capable of meeting the required quality.

\- Reserve stronger reasoning for difficult synthesis, prioritization, planning, or high-impact decisions.

\- Avoid unnecessary AI calls, retries, duplicate generations, and excessive context.

\- Preserve AI usage/cost telemetry where applicable.



\## Codex Efficiency



\- Keep task scope narrow.

\- Inspect only files relevant to the requested change before expanding search.

\- Do not perform a full repository audit unless genuinely required.

\- Do not spawn subagents unless parallel investigation is materially useful.

\- Run targeted tests during implementation.

\- Run broader tests/builds when the completed change or regression risk justifies them.

\- Run the full release suite only when explicitly requested, preparing a release, or required by the task.

\- Keep final reports concise.



\## Completion



Before finishing:



1\. Verify the requested behavior.

2\. Run appropriate targeted tests.

3\. Run typecheck/build when justified.

4\. Check touched flows for obvious regressions.

5\. Stop when the requested scope is complete.



Unless requested otherwise, report only:



1\. What changed

2\. Tests/build results

3\. Remaining risks

4\. Anything requiring manual action



