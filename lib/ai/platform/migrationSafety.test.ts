import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717221946_central_ai_platform.sql"),
  "utf8",
).toLowerCase();
const rateLimitMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717222925_ai_soft_caps_and_rate_limits.sql"),
  "utf8",
).toLowerCase();
const reconciliationMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717224124_ai_failed_quota_reconciliation.sql"),
  "utf8",
).toLowerCase();

describe("central AI migration safety contract", () => {
  it("keeps financial rows server-only with RLS and explicit grants", () => {
    expect(migration).toContain("alter table public.ai_requests enable row level security");
    expect(migration).toContain("revoke all on public.ai_requests from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update on public.ai_requests to service_role");
    expect(migration).toContain("revoke all on function public.reserve_ai_request(jsonb) from public, anon, authenticated");
  });

  it("serializes quota checks and prevents duplicate logical provider calls", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("unique (user_id, task_id, project_scope, idempotency_key_hash)");
    expect(migration).toContain("and status = 'reserved'");
    expect(migration).toContain("and input_hash = p_request->>'input_hash'");
    expect(rateLimitMigration).toContain("interval '1 minute'");
    expect(rateLimitMigration).toContain("interval '10 minutes'");
    expect(rateLimitMigration).toContain("ai_global_soft_cap_reached");
  });

  it("requires project ownership and records reconciliation states", () => {
    expect(migration).toContain("and user_id = v_user_id");
    expect(migration).toContain("and deleted_at is null");
    expect(migration).toContain("'reconciliation_needed'");
    expect(migration).toContain("actual_cost_usd");
    expect(reconciliationMigration).toContain("and status = 'failed'");
    expect(reconciliationMigration).toContain("'task_daily_limit'");
  });
});
