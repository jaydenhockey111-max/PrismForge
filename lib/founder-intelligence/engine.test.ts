import { describe, expect, it } from "vitest";
import { buildFounderIntelligenceProfile, buildPersonalizationContext, weeklyQuestLimit } from "@/lib/founder-intelligence/engine";
import type { ActiveFounderPattern } from "@/lib/founder-intelligence/types";

const repeated: ActiveFounderPattern = {
  patternId: "11111111-1111-4111-8111-111111111111",
  category: "blocker",
  headline: "Scope was recorded as a blocker in three comparable projects.",
  explanation: "A descriptive observation.",
  evidenceTier: "repeated_pattern",
  supportingProjectCount: 3,
  contradictingProjectCount: 0,
  dimensions: { project_type: "ai_tool" },
  limitations: ["Current evidence still wins."],
};

describe("Founder Intelligence", () => {
  it("keeps zero-history founders in an honest insufficient-history state", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", projectSnapshots: [], patterns: [] });
    expect(profile.adaptationState.confidence).toBe("insufficient_history");
    expect(profile.adaptationState.guidanceModeRecommendation).toBe("guided");
    expect(profile.verifiedExperience.eligibleProjectCount).toBe(0);
  });

  it("does not turn one project into heavy personalization", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", projectSnapshots: [{ projectId: "p1", eligibilityStatus: "fully_eligible", experimentCount: 2, meaningfulDecisionCount: 1, externalEvidenceCount: 2, revenueEvidenceCount: 0 }], patterns: [] });
    expect(profile.adaptationState.confidence).toBe("insufficient_history");
    expect(profile.adaptationState.guidanceModeRecommendation).not.toBe("autonomous");
  });

  it("keeps explicit choices separate from inferred recommendations", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", preferences: { guidanceMode: "guided", explanationDepth: "detailed", questIntensity: "light" }, projectSnapshots: [0,1,2].map((index) => ({ projectId: `p${index}`, eligibilityStatus: "fully_eligible" as const, experimentCount: 3, meaningfulDecisionCount: 2, externalEvidenceCount: 2, revenueEvidenceCount: 0 })), patterns: [repeated] });
    expect(profile.explicitPreferences.guidanceMode).toBe("guided");
    expect(profile.adaptationState.guidanceModeRecommendation).toBe("autonomous");
  });

  it("excludes history when the founder disables it", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", preferences: { historicalPersonalizationEnabled: false }, projectSnapshots: [], patterns: [repeated] });
    const context = buildPersonalizationContext({ profile, patterns: [repeated], currentProject: { projectType: "ai_tool" } });
    expect(context.relevantPatterns).toHaveLength(0);
    expect(context.excludedPatterns[0]?.reason).toBe("personalization_disabled");
  });

  it("omits patterns that are not comparable to the current project", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", projectSnapshots: [], patterns: [repeated] });
    const context = buildPersonalizationContext({ profile, patterns: [repeated], currentProject: { projectType: "local_service" } });
    expect(context.relevantPatterns).toHaveLength(0);
    expect(context.excludedPatterns[0]?.reason).toBe("not_comparable");
  });

  it("honors dismissed and corrected patterns", () => {
    const profile = buildFounderIntelligenceProfile({ userId: "u1", projectSnapshots: [], patterns: [repeated], dismissedPatternIds: [repeated.patternId] });
    const context = buildPersonalizationContext({ profile, patterns: [repeated], currentProject: { projectType: "ai_tool" } });
    expect(context.excludedPatterns).toContainEqual({ patternId: repeated.patternId, reason: "dismissed" });
  });

  it("keeps current evidence above an assumption-history pattern", () => {
    const assumption = { ...repeated, category: "assumption" };
    const profile = buildFounderIntelligenceProfile({ userId: "u1", projectSnapshots: [], patterns: [assumption] });
    const context = buildPersonalizationContext({ profile, patterns: [assumption], currentProject: { projectType: "ai_tool", externalEvidenceCount: 2 } });
    expect(context.excludedPatterns[0]?.reason).toBe("current_context_conflict");
  });

  it("uses deterministic quest limits without changing XP", () => {
    expect(weeklyQuestLimit("light")).toBe(2);
    expect(weeklyQuestLimit("standard")).toBe(3);
    expect(weeklyQuestLimit("ambitious")).toBe(4);
  });
});

