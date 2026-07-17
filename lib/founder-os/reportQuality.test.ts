import { describe, expect, it } from "vitest";
import { validateGeneratedReport } from "./reportQuality";
import { createMockOpportunityReport } from "./reportFallback";
import type { OpportunityReport, UserOpportunityInput } from "./types";

const input: UserOpportunityInput = {
  interests: "golf practice",
  skills: "research",
  budget: 50,
  timePerWeek: 5,
  targetAudience: "recreational golfers",
  businessType: "digital_product",
  goal: "side_income",
  riskTolerance: 5,
  existingIdea: "Golf practice planner",
};

describe("generated report quality", () => {
  it("accepts the deterministic fallback report", () => {
    const report = reportFixture();
    const result = validateGeneratedReport(report, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.summary.title).toBeTruthy();
      expect(result.report.summary.painPoint).not.toMatch(/no idea|whatever/i);
    }
  });

  it("accepts the deterministic fallback report for the beta content-creator create-project path", () => {
    const betaInput: UserOpportunityInput = {
      interests: "content creation",
      skills: "writing, sales",
      budget: 100,
      timePerWeek: 8,
      targetAudience: "Small YouTubers",
      businessType: "ai_tool",
      goal: "side_income",
      riskTolerance: 5,
      existingIdea: "Content idea tracker",
    };

    const result = validateGeneratedReport(createMockOpportunityReport(betaInput), betaInput);

    if (!result.ok) expect(result.reason).toBe("");
    expect(result.ok).toBe(true);
  });

  it("rejects malformed report shape", () => {
    const result = validateGeneratedReport({ summary: { title: "Golf" } }, input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("generation_schema_error");
  });

  it("rejects placeholder-filled semantic output", () => {
    const report = reportFixture();
    const result = validateGeneratedReport({
      ...report,
      summary: {
        ...report.summary,
        targetCustomer: "everyone",
      },
    }, input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("generation_quality_error");
  });

  it("repairs safe title issues without fabricating evidence", () => {
    const report = reportFixture();
    const result = validateGeneratedReport({
      ...report,
      summary: { ...report.summary, title: "I want to create a" },
    }, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.summary.title).toBe("Golf Practice Planner");
      expect(result.report.marketValidation.confidenceNotes.join(" ")).not.toMatch(/validated|revenue/i);
    }
  });
});

function reportFixture(): OpportunityReport {
  return {
    generatedAt: "2026-07-10T00:00:00.000Z",
    input,
    score: { overall: 75, demand: 70, competition: 60, monetization: 70, easeOfMvp: 80, virality: 60, founderFit: 90, recurringRevenue: 50, breakdown: [] },
    summary: {
      title: "Golf Practice Planner",
      oneSentenceIdea: "A structured practice planner for recreational golfers who want to improve without scattered advice.",
      targetCustomer: "recreational golfers",
      painPoint: "Recreational golfers struggle to turn scattered swing advice into consistent practice.",
      whyNow: "Cheap digital tools make small practice systems easier to test.",
      whyThisCouldMakeMoney: "Golfers may pay for a focused shortcut if the practice system proves useful.",
      businessModel: "Free starter plan with paid templates or coaching workflows.",
    },
    marketValidation: {
      searchDemandAssumptions: ["Golfers search for practice plans."],
      socialDemandAssumptions: ["Golf creators share swing tips."],
      competitorLandscape: "Alternatives include coaches, YouTube, and generic trackers.",
      existingAlternatives: ["YouTube lessons", "Local coaches"],
      userComplaints: ["Advice is scattered."],
      underservedAngle: "A weekly practice structure may be easier to act on than more tips.",
      confidenceNotes: ["No real-world proof collected yet."],
    },
    competitors: [],
    mvpPlan: {
      featureList: ["Weekly practice plan"],
      mustHaveFeatures: ["Practice plan", "Progress log"],
      niceToHaveFeatures: ["Video notes"],
      doNotBuildYet: ["Advanced swing analysis"],
      technicalComplexity: "Low",
      suggestedStack: ["Landing page", "Spreadsheet"],
      sevenDayBuildPlan: ["Create one practice template"],
      thirtyDayLaunchPlan: ["Test with golfers"],
    },
    monetizationPlan: {
      freeTier: ["One practice template"],
      premiumTier: ["More templates"],
      suggestedPrice: "$9/mo",
      tierFeatureMap: [],
      upsellStrategy: "Offer premium practice plans.",
      whyUsersWouldPay: "They want structure that saves time.",
    },
    contentPlan: {
      shortFormHooks: ["Most golfers practice the wrong way."],
      videoScripts: [],
      tweetIdeas: ["Practice beats random tips."],
      redditAngles: ["How do you structure practice?"],
      seoArticleTitles: ["Golf practice plan for beginners"],
      shockValueAngle: "More tips can make practice worse.",
      educationalAngle: "Teach a simple weekly practice loop.",
      buildingInPublicAngle: "Testing a golf practice planner.",
    },
    landingPageCopy: {
      heroHeadline: "Practice golf with a plan",
      subheadline: "A simple weekly practice system for recreational golfers.",
      cta: "Join beta",
      benefitBullets: ["Know what to practice"],
      socialProofPlaceholder: "No proof collected yet.",
      faq: [],
      pricingSectionCopy: "Start free.",
    },
    executionRoadmap: {
      today: ["Find 5 golfer complaints"],
      thisWeek: ["Interview 5 golfers"],
      thisMonth: ["Test a template"],
      first100UsersPlan: ["Share in golf communities"],
      first1000RevenuePlan: ["Sell templates"],
      biggestRisks: ["Golfers may prefer coaches."],
      howToTestQuickly: ["Ask golfers about practice habits."],
    },
    generationMode: "mock",
  };
}
