import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canTransition, chooseFallbackFocus, compareLifecycleProjects, matchesLifecycleFilter, PERMANENT_DELETION_POLICY, type LifecycleSummary } from "./projectLifecycle";

const active: LifecycleSummary = { id:"active",title:"Active",lifecycleStatus:"active",stage:"validating",isCurrentFocus:false,deletedAt:null,lastMeaningfulActivityAt:"2026-07-10T00:00:00Z",createdAt:"2026-07-01T00:00:00Z" };
const focus: LifecycleSummary = { ...active,id:"focus",title:"Focus",isCurrentFocus:true,lastMeaningfulActivityAt:"2026-07-09T00:00:00Z" };
const paused: LifecycleSummary = { ...active,id:"paused",title:"Paused",lifecycleStatus:"paused",lastMeaningfulActivityAt:"2026-07-11T00:00:00Z" };
const deleted: LifecycleSummary = { ...active,id:"deleted",title:"Deleted",deletedAt:"2026-07-12T00:00:00Z" };

describe("project lifecycle policy", () => {
  it("separates lifecycle transitions from founder stage", () => {
    expect(canTransition("active","pause",null)).toBe(true); expect(canTransition("paused","resume",null)).toBe(true); expect(canTransition("archived","restore",null)).toBe(true); expect(canTransition("active","resume",null)).toBe(false);
  });
  it("keeps deleted projects out of ordinary views and recoverable explicitly", () => {
    expect(matchesLifecycleFilter(deleted,"all")).toBe(false); expect(matchesLifecycleFilter(deleted,"deleted")).toBe(true); expect(canTransition("active","restore",deleted.deletedAt)).toBe(true);
  });
  it("prioritizes explicit focus without treating all active projects equally", () => {
    expect([active,focus,paused].sort((a,b)=>compareLifecycleProjects(a,b,"focus"))[0]?.id).toBe("focus"); expect(chooseFallbackFocus([paused,active])?.id).toBe("active");
  });
  it("documents private deletion and XP preservation", () => {
    expect(PERMANENT_DELETION_POLICY.cascades.join(" ")).toMatch(/evidence|outputs/); expect(PERMANENT_DELETION_POLICY.preserved.join(" ")).toMatch(/XP/);
  });
});

describe("project lifecycle migration security contract", () => {
  const sql = readFileSync("supabase/migrations/20260712000014_project_lifecycle.sql","utf8");
  it("is additive, transactional, and keeps stage separate", () => { expect(sql).toMatch(/^--[\s\S]*begin;/i); expect(sql).toContain("lifecycle_status"); expect(sql).toContain("comment on column public.opportunity_projects.status"); expect(sql).toContain("commit;"); });
  it("enforces one focus row and optimistic lifecycle concurrency", () => { expect(sql).toContain("user_id uuid primary key"); expect(sql).toContain("lifecycle_version"); expect(sql).toContain("for update"); expect(sql).toContain("Project changed in another tab"); });
  it("protects lifecycle fields from direct client writes", () => { expect(sql).toContain("revoke insert, update, delete on public.opportunity_projects from authenticated"); expect(sql).toContain("grant update (title, business_type, target_customer, score, status, report_json, updated_at)"); expect(sql).not.toMatch(/grant update \([^)]*lifecycle_status/); });
  it("validates auth and ownership inside privileged RPCs", () => { expect(sql).toContain("actor uuid := auth.uid()"); expect(sql).toContain("p.user_id = actor"); expect(sql).toContain("set search_path = public, pg_temp"); expect(sql).toContain("revoke all on function public.transition_project_lifecycle"); });
  it("preserves XP while removing private project content", () => { expect(sql).toContain("update public.xp_events set metadata"); expect(sql).toContain("source_id = null"); expect(sql).toContain("delete from public.opportunity_projects"); });
  it("does not award XP for lifecycle or focus actions", () => { expect(sql).not.toContain("record_founder_xp_event("); expect(sql).not.toMatch(/insert into public\.xp_events/i); });
  it("contains targeted legacy updates and supporting indexes", () => { expect(sql).toContain("where lifecycle_status is null"); expect(sql).toContain("opportunity_projects_user_lifecycle_activity_idx"); expect(sql).toContain("where deleted_at is null"); });
});
