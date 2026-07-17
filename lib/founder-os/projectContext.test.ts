import { describe, expect, it } from "vitest";
import { generateCeoDirective } from "./ceoDirective";
import { generateSprintTasks, generateValidationSurvey } from "./executionTools";
import { createMockOpportunityReport } from "./reportFallback";
import { synthesizeProjectConcept, createProjectContext } from "./projectContext";
import { validateTextLogic } from "./logicValidator";
import type { UserOpportunityInput } from "./types";

const studyInput: UserOpportunityInput = {
  interests: "study planning, homework, exams",
  skills: "research, writing",
  budget: 50,
  timePerWeek: 5,
  targetAudience: "High school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 4,
  existingIdea: "Study planner",
};

describe("PrismForge Context Engine", () => {
  it("infers education projects and avoids generic startup launch language", () => {
    const report = createMockOpportunityReport(studyInput);
    const context = createProjectContext({ report, status: "idea" });
    const directive = generateCeoDirective({ report, status: "idea" });
    const survey = generateValidationSurvey(report);
    const tasks = generateSprintTasks(report);
    const combined = JSON.stringify({ directive, survey, tasks }).toLowerCase();

    expect(context.projectType).toBe("Education Tool");
    expect(context.solutionCategory).toBe("Education");
    expect(context.language.releaseNoun).toBe("pilot");
    expect(combined).toContain("students");
    expect(combined).not.toMatch(/students.*launching startups|customer acquisition|growth loop|series a/);
  });

  it("infers agency/service context without app-store style blockers", () => {
    const report = createMockOpportunityReport({
      ...studyInput,
      interests: "local business websites",
      targetAudience: "local restaurant owners",
      businessType: "local_service",
      existingIdea: "Website audit service",
    });
    const context = createProjectContext({ report, status: "idea" });
    const issues = validateTextLogic("You need an App Store launch and prototype app first.", context);

    expect(context.projectType).toBe("Local Business");
    expect(context.language.releaseNoun).toBe("first client test");
    expect(issues.map((issue) => issue.code)).toContain("project_type_mismatch");
  });

  it("synthesizes a blank idea locally when structured inputs are enough", () => {
    const result = synthesizeProjectConcept({
      ...studyInput,
      existingIdea: undefined,
      targetAudience: "High school students",
      interests: "exam planning",
    });

    expect(result.usedOpenAi).toBe(false);
    expect(result.confidence).toBe("medium");
    expect(result.concept).toMatch(/exam planning/i);
  });

  it("falls back to low-confidence general project when context is too thin", () => {
    const result = synthesizeProjectConcept({
      ...studyInput,
      existingIdea: undefined,
      targetAudience: "x",
      interests: "",
    });

    expect(result.usedOpenAi).toBe(false);
    expect(result.confidence).toBe("low");
    expect(result.concept).toBe("General Project");
  });
});
