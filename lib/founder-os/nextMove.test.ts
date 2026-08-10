import { describe, expect, it } from "vitest";
import { buildNextMove, evidenceState } from "./nextMove";
import { createMockOpportunityReport } from "./reportFallback";
import { routeValidationPath } from "./validationReadiness";
import { summarizeProof } from "../proof-board";

const input = {
  interests: "student learning",
  skills: "writing and research",
  budget: 50,
  timePerWeek: 4,
  targetAudience: "high school students preparing for difficult exams",
  businessType: "ai_tool" as const,
  goal: "side_income" as const,
  riskTolerance: 3,
  existingIdea: "A study planner that helps students choose what to revise next",
};

describe("canonical Next Move", () => {
  it("creates exactly one recommendation from project state and founder constraints", () => {
    const report = createMockOpportunityReport(input);
    const proof = summarizeProof([]);
    const route = routeValidationPath({ report, status: "idea", proof });
    const move = buildNextMove({ projectId: "project-1", report, status: "idea", proof, route });

    expect(move.title).toBeTruthy();
    expect(move.routeKey).toBe(route.pathType);
    expect(move.primaryHref).toBe("/projects/project-1?section=validate#execution-support");
    expect(move.primaryLabel).toBe("Help me do it");
    expect(move.constraintNote).toContain("4 hours per week");
    expect(move.constraintNote).toContain("$50 budget");
    expect(move.evidenceState).toBe("No external evidence recorded yet");
    expect(move.actionType).not.toBe("ai_executable");
  });

  it("reports factual evidence instead of a synthetic confidence score", () => {
    const proof = summarizeProof([{ people_contacted: 5, replies: 4, pain_confirmed: 3 }]);
    expect(evidenceState(proof)).toBe("4 replies and 3 problem signals recorded");
  });
});
