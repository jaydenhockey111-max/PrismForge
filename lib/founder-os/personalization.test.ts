import { describe, expect, it } from "vitest";
import { createMvpPlan } from "./mvpPlanner";
import { createRoadmap } from "./roadmapGenerator";
import type { UserOpportunityInput } from "./types";

const base: UserOpportunityInput = {
  interests: "AI study planning",
  skills: "research",
  budget: 0,
  timePerWeek: 5,
  targetAudience: "high school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 2,
  existingIdea: "AI study coach for high school students",
};

describe("founder-profile personalization", () => {
  it("gives constrained founders a smaller manual MVP path", () => {
    const plan = createMvpPlan(base);
    const text = [
      ...plan.sevenDayBuildPlan,
      ...plan.thirtyDayLaunchPlan,
      ...plan.doNotBuildYet,
    ].join(" ");

    expect(text).toMatch(/manual|concierge|do not build custom software/i);
    expect(text).toMatch(/3 people|5 students|8 conversations/i);
  });

  it("gives high-capacity technical founders a meaningfully different execution plan", () => {
    const highCapacity: UserOpportunityInput = {
      ...base,
      skills: "coding, design, sales",
      budget: 10_000,
      timePerWeek: 30,
      riskTolerance: 9,
    };
    const lowPlan = createRoadmap(base);
    const highPlan = createRoadmap(highCapacity);

    expect(lowPlan.today.join(" ")).toMatch(/Send 3/);
    expect(highPlan.today.join(" ")).toMatch(/Send 12/);
    expect(lowPlan.thisWeek.join(" ")).toMatch(/manual|concierge/i);
    expect(highPlan.thisWeek.join(" ")).toMatch(/prototype/i);
    expect(highPlan.thisWeek.join(" ")).not.toEqual(lowPlan.thisWeek.join(" "));
  });
});
