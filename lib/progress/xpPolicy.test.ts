import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { levelFromXp, levelProgress, stageForLevel, xpForLevel } from "./levelPolicy";
import { ACTION_XP, calculateAwardedXp, FOUNDER_XP_RULES, VERIFICATION_MULTIPLIERS, ZERO_XP_EVENTS } from "./xpPolicy";

describe("evidence-based founder XP policy", () => {
  it("weights evidence above unsupported claims", () => {
    expect(calculateAwardedXp("proof_experiment_completed", "evidence_supported")).toBe(35);
    expect(calculateAwardedXp("proof_experiment_completed", "manual_detailed")).toBe(18);
    expect(calculateAwardedXp("proof_experiment_completed", "self_reported")).toBe(0);
    expect(VERIFICATION_MULTIPLIERS.system_verified).toBe(1);
  });

  it("assigns zero XP to old activity-only paths", () => {
    expect(Object.values(ACTION_XP).every((value) => value === 0)).toBe(true);
    expect(ZERO_XP_EVENTS.join(" ")).toMatch(/AI|Refreshing|tabs|Duplicate/i);
  });

  it("uses modest milestone values and diminishing contact milestones", () => {
    expect(FOUNDER_XP_RULES.first_customer_contact.baseXp).toBe(20);
    expect(FOUNDER_XP_RULES.five_customer_contacts.baseXp).toBe(35);
    expect(FOUNDER_XP_RULES.ten_customer_contacts.baseXp).toBe(25);
    expect(FOUNDER_XP_RULES.first_revenue.baseXp).toBeLessThan(100);
  });
});

describe("professional founder level curve", () => {
  it("has increasing thresholds through long-term use", () => {
    for (let level = 2; level <= 50; level += 1) expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1));
    expect(stageForLevel(1).name).toBe("Explorer");
    expect(stageForLevel(40).name).toBe("Experienced Founder");
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(50);
  });

  it("handles exact boundaries, multi-level gains, and reversals deterministically", () => {
    const level10 = xpForLevel(10);
    expect(levelFromXp(level10 - 1)).toBe(9);
    expect(levelFromXp(level10)).toBe(10);
    expect(levelFromXp(xpForLevel(15))).toBe(15);
    expect(levelProgress(xpForLevel(10)).progress).toBe(0);
    expect(levelFromXp(Math.max(0, level10 - 100))).toBeLessThanOrEqual(9);
  });
});

describe("progression migration security contract", () => {
  const sql = readFileSync("supabase/migrations/20260711000012_evidence_founder_progression.sql", "utf8");

  it("keeps the ledger server-authoritative and idempotent", () => {
    expect(sql).toContain("record_founder_xp_event");
    const signature = sql.match(/record_founder_xp_event\(([\s\S]*?)\)\s*returns table/)?.[1] ?? "";
    expect(signature).not.toContain("p_xp");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("revoke all on function public.record_founder_xp_event");
    expect(sql).toContain("grant execute on function public.record_founder_xp_event");
  });

  it("preserves legacy totals and supports traceable reversals", () => {
    expect(sql).toContain("legacy_xp");
    expect(sql).toContain("reverse_founder_xp_event");
    expect(sql).toContain("reverses_event_id");
    expect(sql).toContain("xp_events_append_only");
  });

  it("contains duplicate, burst, ownership, and reward safeguards", () => {
    expect(sql).toContain("Progress source does not belong to this user");
    expect(sql).toContain("unrealistic_progress_burst");
    expect(sql).toContain("xp_event_duplicate_prevented");
    expect(sql).toContain("on conflict (user_id,reward_key) do nothing");
    expect(sql).toContain("project_closure_reflections");
    expect(sql).toContain("project_closed_reflection");
  });
});
