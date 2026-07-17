import { describe, expect, it } from "vitest";
import { evaluateOutputValue, improveReportValue, preserveStrongOriginalIdea } from "./outputValue";
import { createMockOpportunityReport } from "./reportFallback";
import type { UserOpportunityInput } from "./types";

const strongStudyIdea = "An AI study coach that helps high school students turn homework, notes, weak topics, and test dates into a simple seven-day study plan with daily tasks, reminders, and progress tracking.";

const input: UserOpportunityInput = {
  interests: "student productivity, AI tools",
  skills: "research, writing",
  budget: 50,
  timePerWeek: 5,
  targetAudience: "high school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 3,
  existingIdea: strongStudyIdea,
};

describe("output value guard", () => {
  it("detects exact restatement of founder input", () => {
    const finding = evaluateOutputValue({
      field: "summary.oneSentenceIdea",
      candidate: strongStudyIdea,
      rawInputs: [strongStudyIdea, input.targetAudience],
    });

    expect(finding?.issue).toBe("exact_restatement");
  });

  it("preserves strong original ideas over weaker generated rewrites", () => {
    const decision = preserveStrongOriginalIdea(
      strongStudyIdea,
      "A ai tool AI assistant that helps high school students taking multiple difficult classes who feel overwhelmed before tests turn AI tools problems into clear next actions.",
    );

    expect(decision.preserve).toBe(true);
    expect(decision.value).toBe(strongStudyIdea);
  });

  it("replaces low-value generated sections with useful deterministic fallbacks", () => {
    const report = createMockOpportunityReport(input);
    const improved = improveReportValue({
      ...report,
      summary: {
        ...report.summary,
        oneSentenceIdea: "A ai tool AI assistant that helps high school students taking multiple difficult classes who feel overwhelmed before tests turn AI tools problems into clear next actions.",
        whyNow: input.targetAudience,
      },
      marketValidation: {
        ...report.marketValidation,
        underservedAngle: "high school students student productivity AI tools",
      },
    }, input);

    expect(improved.report.summary.oneSentenceIdea).toBe(strongStudyIdea);
    expect(improved.report.summary.whyNow).not.toBe(input.targetAudience);
    expect(improved.findings.some((finding) => finding.issue === "weak_rewrite_of_strong_input")).toBe(true);
    expect(improved.findings.some((finding) => finding.action === "fallback_replaced")).toBe(true);
  });

  it("does not flag useful synthesis that adds a recommendation", () => {
    const finding = evaluateOutputValue({
      field: "executionRoadmap.today.0",
      candidate: "First, test whether students will upload real notes by asking 5 classmates to try a manual seven-day plan.",
      rawInputs: [strongStudyIdea, input.targetAudience],
    });

    expect(finding).toBeNull();
  });
});
