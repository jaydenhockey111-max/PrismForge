import { describe, expect, it } from "vitest";
import { routeFounderModelTask } from "@/lib/founder-intelligence/modelRouting";

describe("Founder Intelligence model routing", () => {
  it("never uses AI for deterministic personalization", () => {
    expect(routeFounderModelTask("guidance_adaptation", { explicitUserAction: true, featureAuthorized: true }).usesAi).toBe(false);
  });
  it("requires explicit authorization for a deep review", () => {
    expect(routeFounderModelTask("founder_patterns_deep_review", { explicitUserAction: false, featureAuthorized: true }).usesAi).toBe(false);
    expect(routeFounderModelTask("founder_patterns_deep_review", { explicitUserAction: true, featureAuthorized: false }).usesAi).toBe(false);
  });
});

