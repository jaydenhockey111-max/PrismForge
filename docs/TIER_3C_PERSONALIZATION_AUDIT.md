# Tier 3C Personalization Audit

## Existing canonical systems

- `profiles` stores identity, founder goals, interests, education, and account preferences. It is not used as an authorization source beyond the existing secure role mechanism.
- `OpportunityReport.input` is the canonical project-time record of budget, weekly hours, skills, risk tolerance, business type, audience, and founder idea.
- `ProjectContext` normalizes the current project, language, founder constraints, proof, and stage.
- `validation_paths`, `project_assumptions`, `project_decisions`, Proof Board experiments, lifecycle history, and closure reflections contain structured founder actions and evidence.
- `founder_project_learning_snapshots` and `founder_pattern_insights` are the canonical Tier 3B historical-learning layer.
- Quest routing is deterministic in `lib/progress/questPolicy.ts`.
- Validation routing is deterministic in `lib/founder-os/validationReadiness.ts`.
- AI usage is explicit, server-authoritative, cached, cooldown-protected, and plan-limited.

## Gaps found before Tier 3C

- No canonical founder-owned guidance mode, explanation detail, or weekly pace existed.
- Historical reminders could not be disabled independently.
- Project creation did not prefill reliable time/risk constraints.
- Next Best Action always rendered the same explanation depth.
- Quest count was driven by weekly time only, not an explicit founder preference.
- AI Team prompts used compact project context but no centralized, filtered founder-history summary.
- Level was visible but was not—and remains not—a safe proxy for desired guidance.

## Reliable personalization sources

- Explicit founder guidance preferences.
- Current project context and current proof state.
- Eligible Tier 3B snapshots.
- Active repeated or strong personal patterns with provenance.
- Structured decisions, experiments, validation paths, lifecycle state, and founder-authored closure reflections as summarized by Tier 3B.

## Sources intentionally excluded or constrained

- Synthetic, deleted, and founder-excluded projects.
- Dismissed or corrected patterns.
- One-project observations as heavy personalization.
- Full project text, interview transcripts, customer identities, raw prompts, and prior AI responses.
- Founder level as a routing threshold.
- Inferences about personality, intelligence, discipline, talent, ambition, or sensitive attributes.

## Legacy limitations

Older projects may lack project-time constraints, stage history, decisions, validation-path events, or closure reflections. Those projects remain partial or ineligible in Tier 3B and cannot create strong Tier 3C adaptation. The UI reports missing sources instead of fabricating them.

## Automatic AI audit

Tier 3C profile calculation, relevance filtering, explanation depth, quest pacing, validation presentation, project-creation prefill, and Next Best Action context are deterministic. No page load or preference change calls OpenAI. AI Team calls remain explicit user clicks and receive at most two relevant pattern summaries.

