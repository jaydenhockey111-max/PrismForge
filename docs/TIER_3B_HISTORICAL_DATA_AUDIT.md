# Tier 3B Historical Data Audit

## Reliable structured sources

| Source | Classification | Used for |
|---|---|---|
| `opportunity_projects` stage, lifecycle, dates, business type | Authoritative structured state | Eligibility, project type, current outcome |
| `project_stage_history` | Authoritative structured history | Closed-stage durations and stage reached |
| `project_lifecycle_events` | Authoritative structured history | Pause exclusion and lifecycle outcome context |
| `project_validation_experiments` numeric fields and evidence type | User-reported structured evidence | External-signal counts, conversations, time to evidence, validation-method comparisons |
| `validation_paths` and `validation_path_events` | Deterministic structured routing history | Methods attempted and paths completed |
| `project_decisions` | Founder-authored structured history | Decision frequency and evidence recorded after decisions |
| `project_assumptions` status | Structured state | Supported, contradicted, inconclusive, and untested summaries |
| `project_closure_reflections` | Founder-authored structured learning | Recorded lessons and conservative keyword-based blocker categories |
| `founder_timeline_events` | Canonical historical index | Timeline integration and future provenance expansion |
| Original `report_json.input` only | Founder-provided project-time snapshot | Hours, budget, risk tolerance, and recorded technical skills |

## Sources deliberately not treated as founder evidence

- AI Team outputs, report recommendations, generated landing pages, marketing copy, and AI prose: suggestions, not founder behavior.
- Page views, clicks, navigation, model usage, generation history, and analytics events: product telemetry only.
- XP totals: proof that PrismForge awarded progression, not proof that a strategy worked.
- Current profile alone: it may differ from circumstances when an older project began.
- Market Pulse and crawler data: explicitly outside Tier 3B.
- Customer names, raw interview transcripts, key quotes, and private customer identities: unnecessary for deterministic comparisons and never loaded.

## Known gaps

- PrismForge does not yet have a canonical structured blocker table. Tier 3B categorizes blockers only from founder-authored closure fields with an approved keyword map and displays that limitation.
- Older projects may lack stage events, lifecycle history, assumptions, validation paths, or closure reflections. They remain partially eligible but cannot create strong timing conclusions from missing fields.
- Historical hours and budget are captured from original project input. Later changes are not reconstructed.
- Evidence is user-reported unless a linked system record provides stronger verification. The UI never upgrades that evidence into a causal claim.

