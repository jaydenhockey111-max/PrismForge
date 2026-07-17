import { describe, expect, it } from "vitest";
import { hasLowQualityProjectOutput, sanitizeFounderInput } from "./guidedIdeaRecovery";
import type { UserOpportunityInput } from "./types";

const base: UserOpportunityInput = {
  interests: "hockey, fitness",
  skills: "writing, research",
  budget: 100,
  timePerWeek: 5,
  targetAudience: "youth hockey players",
  businessType: "digital_product",
  goal: "side_income",
  riskTolerance: 5,
  existingIdea: undefined,
};

describe("guided idea recovery", () => {
  it("recovers a missing placeholder idea from valid interests and skills", () => {
    const result = sanitizeFounderInput({ ...base, existingIdea: "no idea" });
    expect(result.existingIdea).not.toMatch(/no idea/i);
    expect(result.guidedIdeaUsed).toBe(true);
    expect(result.guidedIdeaOptions).toHaveLength(3);
  });

  it("recovers a placeholder target audience", () => {
    const result = sanitizeFounderInput({ ...base, targetAudience: "no clue", existingIdea: "hockey practice planner" });
    expect(result.targetAudience).not.toMatch(/no clue/i);
  });

  it("does not corrupt legitimate no-code ideas", () => {
    const result = sanitizeFounderInput({ ...base, existingIdea: "No-code study planning tool", targetAudience: "students" });
    expect(result.existingIdea).toBe("No-code study planning tool");
  });

  it("detects low-quality saved output", () => {
    expect(hasLowQualityProjectOutput({ title: "No Idea Playbook", targetAudience: "No Clue", painPoint: "whatever" })).toBe(true);
  });
});
