import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tier 3A founder timeline migration", () => {
  const sql = readFileSync("supabase/migrations/20260712000015_founder_timeline.sql", "utf8");
  it("creates one append-only canonical model with owner RLS", () => {
    expect(sql).toContain("create table if not exists public.founder_timeline_events");
    expect(sql).toContain("unique (user_id, dedupe_key)");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("revoke all on public.founder_timeline_events from anon, authenticated");
    expect(sql).toContain("grant select on public.founder_timeline_events to authenticated");
  });
  it("indexes founder, project, category, and deterministic search access", () => {
    for (const marker of ["founder_timeline_user_created_idx","founder_timeline_project_created_idx","founder_timeline_user_category_idx","founder_timeline_search_idx","websearch_to_tsquery"]) expect(sql).toContain(marker);
  });
  it("wires meaningful systems and excludes software activity emitters", () => {
    for (const trigger of ["founder_timeline_lifecycle","founder_timeline_stage","founder_timeline_decision","founder_timeline_validation_path","founder_timeline_proof","founder_timeline_xp","founder_timeline_reflection","founder_timeline_level"]) expect(sql).toContain(trigger);
    expect(sql).not.toMatch(/emit_founder_timeline_event\([\s\S]*?(?:page_opened|clicked|scrolled|ai_generated|theme_changed)/i);
    expect(sql).toContain("Initial system routing occurs while rendering a new project. It is setup, not founder progress.");
  });
  it("references source records and sanitizes permanently deleted projects", () => {
    for (const reference of ["decision_id uuid references","proof_experiment_id uuid references","lifecycle_event_id uuid references","xp_event_id uuid references","validation_path_id uuid references"]) expect(sql).toContain(reference);
    expect(sql).toContain("sanitize_timeline_before_project_delete");
  });
  it("does not call OpenAI or alter the Create Project funnel", () => {
    expect(sql.toLowerCase()).not.toContain("openai");
    expect(sql).not.toContain("app_events");
  });
});
