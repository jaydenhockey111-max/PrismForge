# PrismForge Central AI Platform

## Audit and consolidation

The repository had one direct provider gateway (`lib/ai/generateWithAI.ts`) and three overlapping controls:

1. feature policy and plan checks;
2. a database rate-limit guard that failed open when unavailable;
3. `feature_usage_events`, an operational event table without reservation, actual token cost, or idempotent financial transitions.

The only provider API request was the OpenAI Responses `fetch` inside that gateway. Production callers were Opportunity Report, five execution tools, and four Startup Team specialists. Market Pulse and Founder Brief were deterministic. No browser, route handler, page-load path, or Supabase Edge Function called a model provider.

The gateway now delegates to `lib/ai/platform/executeAiTask.ts`. No feature-specific helper chooses a provider, model, price, timeout, token limit, cache key, quota, or kill switch.

## Request flow

```text
explicit Server Action
→ registered task and prompt envelope
→ authenticated actor / effective plan
→ project requirement
→ controlled model route and price
→ minimized prompt-size guard
→ hashed idempotency and exact-cache identity
→ atomic database reservation
→ private exact-cache or duplicate resolution
→ burst, sustained, plan, task, global soft/hard checks
→ provider abstraction with timeout and bounded retry
→ existing task output and quality validators
→ actual token/cost commit or reconciliation state
→ privacy-safe event and trace
→ saved feature output or deterministic fallback
```

The database reservation verifies profile existence and active project ownership. Advisory transaction locks serialize each user and the global spend calculation. A unique scoped idempotency key and pending-input lookup protect double-clicks, tabs, and retries.

## Registries

- `registry.ts`: existing production tasks, route class, token limits, timeout, exact-cache TTL, plan/task quotas, burst/sustained limits, output schema ID, prompt/schema versions, enablement.
- `promptRegistry.ts`: task-specific safety/quality envelopes. Existing prompt builders remain behavior-compatible.
- `modelRouter.ts`: task-controlled route and emergency deep-route disable.
- `pricing.ts`: effective-dated OpenAI GPT-4.1 mini input, cached-input, and output prices. Unknown models fail closed unless an explicit server override is reviewed.
- `provider.ts`: provider-neutral contract. `openaiProvider.ts` is the only provider-specific HTTP implementation.

## Adding a task

1. Add a real `AiTaskId` and definition to `registry.ts`.
2. Add its safety/quality envelope to `promptRegistry.ts`.
3. Define the feature-specific minimized payload and deterministic fallback.
4. Reuse or add a strict output validator and quality checks.
5. Route the Server Action through `generateJsonWithAI` / `executeAiTask`.
6. Pass an authenticated actor, project ID when required, request ID, source, and explicit cache-bypass intent.
7. Add registry, validation, privacy, fallback, and concurrency tests.
8. Add a runtime task control in an additive migration.
9. Verify the explicit action as a normal user; confirm ledger/cache/output behavior.

## Changing a model

1. Add the exact model identifier and current authoritative price to `pricing.ts`.
2. Review schema/structured-output compatibility and maximum task cost.
3. Set the relevant server route environment variable.
4. Run fixtures, diagnostics, tests, production build, and the normal-user journey.
5. Roll back by restoring the previous route variable. Unknown or removed pricing blocks use rather than treating it as free.

## Cost and performance bounds

Published configured rates are $0.40 per million input tokens, $0.10 per million cached input tokens, and $1.60 per million output tokens.

- Opportunity Report upper-bound reservation: about `$0.0048` at 8,000 input and 1,000 output tokens.
- Other task upper-bound reservation: about `$0.0030–$0.0033` at 5,000 input and 600–800 output tokens.
- Per-user monthly platform ceiling: 50 provider attempts, or under `$0.25` at the largest registered per-request estimate.
- Global hard ceilings: `$2/day` and `$25/month` by default.

These are estimates from configured maximums, not provider invoices. Actual provider usage is committed when returned.

A provider success normally produces four small database writes: reservation, started event, final ledger update, and final event. An exact cache hit avoids the provider and normal generation quota. Infrastructure adds two required database round trips around the provider. No measured browser latency baseline was collected in this pass, so no average-overhead claim is made.

Existing task-specific compact project contexts were preserved. No whole project record, Timeline, analytics, notes, or unrelated project data was added. A pre-change token baseline was not available, so no fabricated token-reduction percentage is reported.

## Known verification boundary

Automated registry, pricing, privacy, migration-contract, full unit/integration, type, lint, production-build, and rollback-only live database tests are available. Production readiness still requires the documented authenticated non-admin browser journey and post-deployment synthetic run.
