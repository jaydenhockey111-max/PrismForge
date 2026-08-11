import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "./reportFallback";
import { mergeAiReport } from "./reportGenerator";
import type { UserOpportunityInput } from "./types";

const input: UserOpportunityInput = {
  interests: "student productivity, AI tools",
  skills: "coding, writing, research",
  budget: 50,
  timePerWeek: 3,
  targetAudience: "high school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 4,
};

describe("project report generation merge", () => {
  it("keeps complete AI synthesis instead of fallback prose", () => {
    const fallback = createMockOpportunityReport(input);
    const merged = mergeAiReport(fallback, {
      summary: {
        oneSentenceIdea: "A weekly study planner that turns upcoming deadlines into a small, ordered plan.",
        painPoint: "Students lose track of which assignment or weak topic deserves attention first.",
        whyNow: "A short manual pilot can test whether students will share real schedules.",
        whyThisCouldMakeMoney: "Payment interest can be tested after students complete a useful weekly plan.",
        businessModel: "Offer a small paid pilot after validating repeat use.",
      },
    }, input);

    expect(merged.summary.painPoint).not.toContain("still needs validation");
    expect(merged.summary.oneSentenceIdea).toContain("weekly study planner");
  });

  it("uses concise safe synthesis when AI omits a summary field", () => {
    const merged = mergeAiReport(createMockOpportunityReport(input), {
      summary: { oneSentenceIdea: "A weekly study planner for high school students." },
    }, input);

    expect(merged.summary.painPoint).toBe("The problem for high school students still needs validation.");
    expect(merged.summary.painPoint).not.toMatch(/scattered advice|unfinished attempts/i);
  });

  it("replaces malformed AI synthesis without changing founder facts", () => {
    const merged = mergeAiReport(createMockOpportunityReport(input), {
      summary: { painPoint: "A ai tool for {audience}" },
    }, input);

    expect(merged.summary.painPoint).toBe("The problem for high school students still needs validation.");
    expect(merged.summary.targetCustomer).toBe("high school students");
  });

  it("keeps full deterministic fallback factual and free of awkward AI-tool grammar", () => {
    const fallback = createMockOpportunityReport(input);

    expect(fallback.generationMode).toBe("mock");
    expect(JSON.stringify(fallback)).not.toMatch(/\ba ai tool\b/i);
    expect(fallback.summary.whyThisCouldMakeMoney).toBe("Whether people will pay is not known yet.");
  });
});
