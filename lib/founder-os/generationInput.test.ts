import { describe, expect, it } from "vitest";
import { assessFounderInputCoherence, canonicalInputKey, normalizeFounderInput, normalizeInputText } from "./generationInput";
import type { UserOpportunityInput } from "./types";

const base: UserOpportunityInput = {
  interests: "student productivity",
  skills: "research",
  budget: 100,
  timePerWeek: 5,
  targetAudience: "high school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 5,
  existingIdea: "AI study coach",
};

describe("generation input reliability", () => {
  it("normalizes whitespace and strips control characters", () => {
    expect(normalizeInputText("  AI\u0000  tools\n\n\nstudents  ")).toBe("AI tools\n\nstudents");
  });

  it("parses and normalizes valid short answers", () => {
    const parsed = normalizeFounderInput({ ...base, targetAudience: " Students ", interests: " Golfers " });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.targetAudience).toBe("Students");
      expect(parsed.data.interests).toBe("Golfers");
    }
  });

  it("rejects fundamentally unusable core input", () => {
    const result = assessFounderInputCoherence({ ...base, interests: "idk", targetAudience: "everyone", existingIdea: "no idea" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("who this is for");
  });

  it("allows usable core input with missing optional budget assumptions", () => {
    const result = assessFounderInputCoherence({ ...base, budget: 0, existingIdea: undefined });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toContain("budget_not_defined");
  });

  it("creates stable idempotency keys for semantically identical input", () => {
    expect(canonicalInputKey(base)).toBe(canonicalInputKey({ ...base, interests: " student   productivity " }));
  });
});
