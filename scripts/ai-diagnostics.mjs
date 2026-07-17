import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("NEXT_PUBLIC_")) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}
const registry = readFileSync(resolve(root, "lib/ai/platform/registry.ts"), "utf8");
const pricing = readFileSync(resolve(root, "lib/ai/platform/pricing.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260717221946_central_ai_platform.sql"), "utf8");
const tasks = [
  "opportunity_report",
  "ceo_ai",
  "marketer_ai",
  "designer_ai",
  "engineer_ai",
  "validation_survey",
  "competitive_battlecard",
  "pricing_tiers",
  "video_scripts",
  "sprint_tasks",
];

const checks = [
  ["OPENAI_API_KEY configured", Boolean(process.env.OPENAI_API_KEY)],
  ["SUPABASE_SERVICE_ROLE_KEY configured", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
  ["All production AI tasks registered", tasks.every((task) => registry.includes(task))],
  ["Default model has controlled pricing", pricing.includes('"gpt-4.1-mini"')],
  ["Unknown model routes fail closed", pricing.includes("AI_ALLOW_UNPRICED_MODEL")],
  ["Ledger RLS enabled", migration.includes("alter table public.ai_requests enable row level security")],
  ["Client ledger grants revoked", migration.includes("revoke all on public.ai_requests from public, anon, authenticated")],
  ["Atomic reservation lock present", migration.includes("pg_advisory_xact_lock")],
];

console.log("PrismForge AI diagnostics (values only; secrets are never printed)");
for (const [label, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
