import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("flexible validation migration security contract", () => {
  const sql = readFileSync("supabase/migrations/20260712000013_flexible_validation_paths.sql", "utf8");

  it("creates an additive, auditable validation model", () => {
    for (const table of ["founder_validation_preferences", "validation_paths", "validation_path_events", "project_assumptions", "project_decisions", "project_stage_history"]) expect(sql).toContain(`public.${table}`);
    expect(sql).toContain("validation_paths_one_active_per_project_idx");
    expect(sql).toContain("request_id");
  });

  it("enables RLS and checks project ownership", () => {
    expect((sql.match(/enable row level security/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(sql).toContain("p.user_id = auth.uid()");
    expect(sql).toContain("user_id = auth.uid()");
  });

  it("keeps history append-only and exposes new tables explicitly", () => {
    expect(sql).toContain("grant select on public.founder_validation_preferences, public.validation_paths, public.validation_path_events, public.project_assumptions, public.project_decisions, public.project_stage_history to authenticated");
    expect(sql).not.toContain("grant select, insert, update, delete on public.validation_path_events");
    expect(sql).toContain("revoke all on public.founder_validation_preferences");
    expect(sql).toContain("grant all on public.founder_validation_preferences");
  });
});
