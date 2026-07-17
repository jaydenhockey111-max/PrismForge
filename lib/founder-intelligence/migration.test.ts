import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260712000017_founder_intelligence.sql"), "utf8").toLowerCase();

describe("Founder Intelligence migration", () => {
  it("enables RLS and owner-only read policies", () => {
    expect(sql).toContain("founder_guidance_preferences enable row level security");
    expect(sql).toContain("founder_intelligence_profiles enable row level security");
    expect(sql).toContain("(select auth.uid()) = user_id");
  });
  it("revokes anonymous access and direct authenticated writes", () => {
    expect(sql).toContain("revoke all on public.founder_guidance_preferences from anon");
    expect(sql).toContain("revoke all on public.founder_intelligence_profiles from authenticated");
  });
  it("requires authentication and request ids in mutation RPCs", () => {
    expect(sql).toContain("if actor is null then raise exception 'authentication required.'");
    expect(sql).toContain("if p_request_id is null then raise exception 'request id is required.'");
    expect(sql).toContain("unique (user_id, request_id, event_type)");
  });
  it("does not create an XP or automatic AI path", () => {
    expect(sql).not.toContain("xp_events");
    expect(sql).not.toContain("openai");
  });
});

