import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("core value feedback migration security contract", () => {
  const sql = readFileSync("supabase/migrations/20260717165714_core_value_feedback.sql", "utf8");
  const cooldownSql = readFileSync("supabase/migrations/20260717182804_core_value_feedback_cooldown.sql", "utf8");

  it("creates an idempotent private feedback and permission record", () => {
    expect(sql).toContain("create table if not exists public.core_value_feedback");
    expect(sql).toContain("unique (user_id, project_id)");
    expect(sql).toContain("unique (user_id, request_id)");
    expect(sql).toContain("contact_permission boolean not null default false");
  });

  it("enforces founder and project ownership for every authenticated write", () => {
    expect(sql).toContain("alter table public.core_value_feedback enable row level security");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("project.user_id = (select auth.uid())");
    expect(sql).toContain("core_value_feedback.project_id");
    expect(sql).not.toContain("for delete");
  });

  it("uses explicit grants and keeps free-form feedback out of app events", () => {
    expect(sql).toContain("revoke all on table public.core_value_feedback from public, anon, authenticated");
    expect(sql).toContain("grant select, insert, update on table public.core_value_feedback to authenticated");
    expect(sql).toContain("grant all on table public.core_value_feedback to service_role");
    expect(sql).toContain("Free-form content is excluded from app_events");
  });

  it("supports a server-owned prompt cooldown without weakening RLS", () => {
    expect(cooldownSql).toContain("alter column rating drop not null");
    expect(cooldownSql).toContain("prompt_dismissed_at");
    expect(cooldownSql).toContain("prompt_eligible_after");
    expect(cooldownSql).not.toContain("disable row level security");
  });
});
