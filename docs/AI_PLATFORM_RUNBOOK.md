# PrismForge AI Platform Runbook

## Scope

All production model calls flow through `lib/ai/platform/executeAiTask.ts`. Model-provider credentials, financial ledger rows, exact cached results, input hashes, and provider request IDs are server-only. Opening pages never starts an AI request.

Registered provider tasks:

- `opportunity_report`
- `ceo_ai`, `marketer_ai`, `designer_ai`, `engineer_ai`
- `validation_survey`, `competitive_battlecard`, `pricing_tiers`, `video_scripts`, `sprint_tasks`

Market Pulse and Founder Brief remain deterministic and do not use the provider.

## Normal verification

```powershell
npm.cmd run diagnose:ai
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

The diagnostics command reports only whether required configuration is present; it never prints secret values.

Use `/admin/ai` for safe 30-day task, status, cache, token, latency, and cost aggregates. That page intentionally excludes prompts, generated output, hashes, provider request IDs, and user identifiers.

## Runtime controls

Controls are stored in `public.ai_runtime_controls`. They are readable and writable only with the service role. Use an authenticated Supabase operator session and record the incident/ticket in `note`.

Disable all AI immediately:

```sql
update public.ai_runtime_controls
set enabled = false, note = 'Emergency global disable: INCIDENT_ID', updated_at = now()
where control_key = 'global';
```

Disable one provider, route, or task by changing the key:

```sql
update public.ai_runtime_controls
set enabled = false, note = 'Disabled: INCIDENT_ID', updated_at = now()
where control_key = 'provider:openai';
```

Examples: `route:openai_balanced`, `task:opportunity_report`, `task:engineer_ai`.

Re-enable only after completing the normal-user verification journey:

```sql
update public.ai_runtime_controls
set enabled = true, note = 'Re-enabled after verification: INCIDENT_ID', updated_at = now()
where control_key = 'global';
```

Environment kill switches are also available: `AI_DISABLE_ALL=1`, `AI_DISABLE_OPENAI=1`, and the legacy `DISABLE_OPENAI=1`. A deployment is required for environment changes.

## Caps and routing

Defaults are conservative beta safety settings:

- global soft daily/monthly: `$1.50` / `$20`
- global hard daily/monthly: `$2` / `$25`
- deep route: disabled
- unknown/unpriced model: blocked

Override with `AI_GLOBAL_SOFT_DAILY_USD`, `AI_GLOBAL_HARD_DAILY_USD`, `AI_GLOBAL_SOFT_MONTHLY_USD`, and `AI_GLOBAL_HARD_MONTHLY_USD`. Route model variables are `AI_MODEL_FAST`, `AI_MODEL_BALANCED`, and `AI_MODEL_DEEP`. Do not set `AI_ALLOW_UNPRICED_MODEL=1` in production without a reviewed price-registry update.

## Reconciliation

`reconciliation_needed` means the provider outcome or billable usage is uncertain, normally after a timeout. Treat the reserved amount as spent until reconciled.

1. Filter `/admin/ai` and the provider dashboard to the incident window.
2. Match by timestamp, model, task, and provider request ID using a server-role query. Never paste prompts or result payloads into tickets.
3. If the provider confirms no charge, set `actual_cost_usd = 0`, `status = 'failed'`, and record the incident in `failure_reason`.
4. If charged, enter the confirmed token counts/cost and set `status = 'failed'`.
5. Do not change a row to `completed` unless a validated result was durably recorded.

## Cost review

1. Open `/admin/ai` and compare provider calls, cache hits, blocked requests, reconciliation count, latency, and cost by task.
2. Investigate an abnormal task or model route using server-role metadata only.
3. Check for repeated failures, cache misses, and input-size growth before increasing a quota.
4. Change route models only through the central registry/environment process in `AI_PLATFORM_ARCHITECTURE.md`.
5. Preserve deterministic fallbacks and the hard global caps when adjusting task or plan limits.

## Rollback

The migration is additive. During an application rollback, leave `ai_requests`, `ai_runtime_controls`, and both RPCs in place so accounting history remains intact. Disable the global control before promoting a pre-platform application version. Do not drop the ledger or cached results during an incident.

Last known deployed application before this local AI-platform change:

- Git commit: `edc3d7fcead82564713f728123a67012e88a9289`
- Vercel deployment: `dpl_4T9TizpLzTHFVWw6tc7aZ4S7bHXX`
- URL: `https://questmint-a1bbel2m8-opportunityhunter.vercel.app`

Exact application rollback:

```powershell
npx vercel promote https://questmint-a1bbel2m8-opportunityhunter.vercel.app
```

The two AI migrations may remain applied because they are additive and client-inaccessible. Before promoting the older application, set the `global` runtime control to `false`; re-enable it only after the central-platform application is redeployed and verified.
