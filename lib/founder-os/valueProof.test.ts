import { describe, expect, it } from "vitest";
import type { ProjectValidationExperiment } from "../database.types";
import type { ProofSummary } from "../proof-board";
import type { OpportunityReport } from "./types";
import { buildValueProofReport, scoreEvidence, scoreProjectClarity } from "./valueProof";

const report = {
  generatedAt: "2026-07-09T00:00:00.000Z",
  input: {
    interests: "hockey training",
    skills: "writing, research",
    budget: 100,
    timePerWeek: 5,
    targetAudience: "athletes",
    businessType: "ai_tool",
    goal: "side_income",
    riskTolerance: 5,
    existingIdea: "An app for athletes",
  },
  score: { overall: 78, demand: 70, competition: 60, monetization: 75, easeOfMvp: 80, virality: 65, founderFit: 90, recurringRevenue: 70, breakdown: [] },
  summary: {
    title: "Hockey Training Planner",
    oneSentenceIdea: "A weekly off-ice training planner for youth hockey players who struggle to train consistently.",
    targetCustomer: "youth hockey players",
    painPoint: "Youth hockey players struggle to train consistently between practices.",
    whyNow: "Teams are using digital tools and parents want better training guidance.",
    whyThisCouldMakeMoney: "Parents may pay for structure that improves consistency.",
    businessModel: "Freemium planner with paid team or parent plans.",
  },
  marketValidation: {
    searchDemandAssumptions: ["Parents search for off-ice drills."],
    socialDemandAssumptions: ["Coaches post training clips."],
    competitorLandscape: "Alternatives include generic workout apps.",
    existingAlternatives: ["Generic workout plans"],
    userComplaints: ["Hard to stay consistent"],
    underservedAngle: "Hockey-specific weekly training is underserved.",
    confidenceNotes: [],
  },
  competitors: [],
  mvpPlan: {
    featureList: ["Weekly plan"],
    mustHaveFeatures: ["Weekly off-ice plan", "Progress tracker"],
    niceToHaveFeatures: ["Team dashboard"],
    doNotBuildYet: ["Advanced video analysis"],
    technicalComplexity: "Low",
    suggestedStack: ["Next.js"],
    sevenDayBuildPlan: ["Build one planner flow"],
    thirtyDayLaunchPlan: ["Test with 10 players"],
  },
  monetizationPlan: {
    freeTier: ["One plan"],
    premiumTier: ["Unlimited plans"],
    suggestedPrice: "$9/mo",
    tierFeatureMap: [],
    upsellStrategy: "Team plans",
    whyUsersWouldPay: "Consistency and sport-specific structure.",
  },
  contentPlan: {
    shortFormHooks: ["Most players train wrong off ice."],
    videoScripts: [],
    tweetIdeas: [],
    redditAngles: [],
    seoArticleTitles: [],
    shockValueAngle: "Missed training compounds.",
    educationalAngle: "Teach weekly training habits.",
    buildingInPublicAngle: "Building with hockey parents.",
  },
  landingPageCopy: {
    heroHeadline: "Train smarter between practices",
    subheadline: "Weekly off-ice plans for hockey players.",
    cta: "Join beta",
    benefitBullets: ["Clear weekly plan"],
    socialProofPlaceholder: "",
    faq: [],
    pricingSectionCopy: "Start free.",
  },
  executionRoadmap: {
    today: ["Message 5 hockey parents"],
    thisWeek: ["Get 3 replies"],
    thisMonth: ["Run a beta"],
    first100UsersPlan: ["Ask teams"],
    first1000RevenuePlan: ["Sell team plans"],
    biggestRisks: ["Parents may not pay."],
    howToTestQuickly: ["Interview 5 hockey parents"],
  },
  generationMode: "mock",
} satisfies OpportunityReport;

function proof(overrides: Partial<ProofSummary> = {}): ProofSummary {
  return {
    people_contacted: 0,
    replies: 0,
    pain_confirmed: 0,
    interested_users: 0,
    waitlist_signups: 0,
    payment_intent: 0,
    preorders_or_revenue_cents: 0,
    experiment_count: 0,
    confidence_score: 0,
    confidence_label: "No evidence yet",
    evidence_sentence: "",
    recommended_next_action: "",
    ...overrides,
  };
}

describe("Value Proof", () => {
  it("scores specific project clarity higher than missing fields", () => {
    const strong = scoreProjectClarity(report);
    const weak = scoreProjectClarity({ ...report, summary: { ...report.summary, targetCustomer: "idk", painPoint: "" } });

    expect(strong.reduce((sum, item) => sum + item.score, 0)).toBeGreaterThan(weak.reduce((sum, item) => sum + item.score, 0));
  });

  it("keeps AI generation separate from real-world evidence", () => {
    const noProofScore = scoreEvidence(proof(), []);
    const generatedReport = buildValueProofReport({
      project: { id: "p1", title: "Test", status: "idea", score: 80, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-09T00:00:00.000Z", target_customer: "students" },
      report,
      proof: proof(),
      experiments: [],
      outputs: [],
    });

    expect(noProofScore.reduce((sum, item) => sum + item.score, 0)).toBe(0);
    expect(generatedReport.evidenceScore).toBe(0);
  });

  it("raises evidence score for real proof and caps at 100", () => {
    const experiments = [{ status: "completed" }] as ProjectValidationExperiment[];
    const items = scoreEvidence(proof({ people_contacted: 20, replies: 8, pain_confirmed: 5, interested_users: 3, waitlist_signups: 2, payment_intent: 1, preorders_or_revenue_cents: 1000 }), experiments);
    const score = Math.round((items.reduce((sum, item) => sum + item.score, 0) / items.reduce((sum, item) => sum + item.max, 0)) * 100);

    expect(score).toBe(100);
  });

  it("uses original input for before/after without fabricating proof", () => {
    const valueProof = buildValueProofReport({
      project: { id: "p1", title: "Hockey", status: "idea", score: 80, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-09T00:00:00.000Z", target_customer: "athletes" },
      report,
      proof: proof(),
      experiments: [],
      outputs: [],
    });

    expect(valueProof.startingPoint).toBe("An app for athletes");
    expect(valueProof.structuredProject).toContain("youth hockey players");
    expect(valueProof.whatUserProved[0]).toContain("No external evidence recorded yet");
    expect(valueProof.snapshot.historyStatus).toBe("original_input_preserved");
    expect(valueProof.snapshot.startingPoint.originalIdea).toBe("An app for athletes");
    expect(valueProof.estimatedTimeSaved).toBeNull();
  });

  it("represents clarity as deterministic fundamentals instead of arbitrary proof", () => {
    const valueProof = buildValueProofReport({
      project: { id: "p1", title: "Hockey", status: "idea", score: 80, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-09T00:00:00.000Z", target_customer: "athletes" },
      report,
      proof: proof(),
      experiments: [],
      outputs: [],
    });

    expect(valueProof.clarityTotalCount).toBeGreaterThan(5);
    expect(valueProof.clarityDefinedCount).toBeLessThanOrEqual(valueProof.clarityTotalCount);
    expect(valueProof.clarityFundamentals.every((item) => item.source.type)).toBe(true);
    expect(valueProof.snapshot.clarityGained.some((item) => /Source|PrismForge/i.test(item.source.label) || item.source.type)).toBe(true);
  });

  it("counts only Proof Board evidence and keeps AI outputs out of evidence", () => {
    const valueProof = buildValueProofReport({
      project: { id: "p1", title: "Hockey", status: "idea", score: 80, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-09T00:00:00.000Z", target_customer: "athletes" },
      report,
      proof: proof(),
      experiments: [],
      outputs: [{ id: "o1", project_id: "p1", user_id: "u1", output_type: "validation_survey", content_json: {}, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-09T00:00:00.000Z" }],
    });

    expect(valueProof.evidenceScore).toBe(0);
    expect(valueProof.evidenceItemCount).toBe(0);
    expect(valueProof.snapshot.prismForgeContribution.some((item) => item.source.type === "project_output")).toBe(true);
  });

  it("links recorded evidence to source experiments", () => {
    const experiment = {
      id: "e1",
      title: "Parent interview sprint",
      status: "completed",
      people_contacted: 5,
      replies: 3,
      pain_confirmed: 2,
      interested_users: 1,
      waitlist_signups: 0,
      payment_intent: 0,
      preorders_or_revenue_cents: 0,
      created_at: "2026-07-09T00:00:00.000Z",
      updated_at: "2026-07-10T00:00:00.000Z",
    } as ProjectValidationExperiment;
    const valueProof = buildValueProofReport({
      project: { id: "p1", title: "Hockey", status: "validating", score: 80, created_at: "2026-07-09T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z", target_customer: "athletes" },
      report,
      proof: proof({ people_contacted: 5, replies: 3, pain_confirmed: 2, interested_users: 1, experiment_count: 1 }),
      experiments: [experiment],
      outputs: [],
    });

    expect(valueProof.snapshot.evidenceCollected.length).toBeGreaterThan(0);
    expect(valueProof.snapshot.evidenceCollected[0].source.type).toBe("proof_board_entry");
    expect(valueProof.snapshot.evidenceCollected[0].source.id).toBe("e1");
    expect(valueProof.snapshot.assumptionsIdentified[0].status).toBe("Partially supported");
  });
});
