import { describe, expect, it } from "vitest";
import { getPlanEntitlements, getEffectivePlan } from "@/lib/billing/planLimits";

describe("central plan entitlements", () => {
  it("keeps the core loop available while restricting paid capacity", () => {
    expect(getPlanEntitlements("free").activeProjects).toBe(1);
    expect(getPlanEntitlements("free").crossProjectLearning).toBe(false);
    expect(getPlanEntitlements("pro").allowedExecutionTiers).toEqual(["light", "standard"]);
    expect(getPlanEntitlements("founder").founderIntelligence).toBe(true);
  });

  it("does not trust a client-claimed plan over the server profile", () => {
    expect(getEffectivePlan({ email: "founder@example.com", plan: "free" })).toBe("free");
    expect(getEffectivePlan({ email: "founder@example.com", plan: "free", lifetime_founder: true })).toBe("founder");
  });
});
