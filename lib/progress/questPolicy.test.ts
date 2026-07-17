import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "@/lib/founder-os/reportFallback";
import type { UserOpportunityInput } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";
import { buildFounderQuestPlan } from "./questPolicy";

const baseInput: UserOpportunityInput = {
  interests: "AI tools, student productivity",
  skills: "writing, research",
  budget: 100,
  timePerWeek: 8,
  targetAudience: "high school students",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 5,
  existingIdea: "AI study coach",
};

const emptyProof: ProofSummary = {
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
  evidence_sentence: "No evidence collected yet.",
  recommended_next_action: "Talk to students.",
};

function project(overrides: Partial<Parameters<typeof buildFounderQuestPlan>[0]["project"]> = {}) {
  const report = createMockOpportunityReport(baseInput);
  return {
    id: "project-1",
    user_id: "user-1",
    title: report.summary.title,
    business_type: report.input.businessType,
    target_customer: report.summary.targetCustomer,
    status: "idea" as const,
    score: 75,
    report_json: report,
    created_at: "2026-07-11T12:00:00.000Z",
    updated_at: "2026-07-11T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildFounderQuestPlan", () => {
  it("creates one daily quest and focused weekly quests from project state", () => {
    const report = createMockOpportunityReport(baseInput);
    const plan = buildFounderQuestPlan({
      userId: "user-1",
      project: project({ report_json: report }),
      report,
      proof: emptyProof,
      now: new Date("2026-07-11T16:00:00.000Z"),
    });

    expect(plan.dailyQuest?.cadence).toBe("daily");
    expect(plan.weeklyQuests.length).toBeGreaterThanOrEqual(2);
    expect(plan.weeklyQuests.length).toBeLessThanOrEqual(4);
    expect(plan.dailyQuest?.title.toLowerCase()).not.toContain("work on your startup");
    expect(plan.dailyQuest?.metadata.nextBestAction).toBeTruthy();
  });

  it("adapts daily scope for low-time and low-risk founders", () => {
    const lowTimeInput = { ...baseInput, timePerWeek: 3, riskTolerance: 2 };
    const report = createMockOpportunityReport(lowTimeInput);
    const plan = buildFounderQuestPlan({
      project: project({ report_json: report, business_type: report.input.businessType }),
      report,
      proof: emptyProof,
      now: new Date("2026-07-11T16:00:00.000Z"),
    });

    expect(plan.dailyQuest?.estimatedTime).toMatch(/10-30|10-15/);
    expect(`${plan.dailyQuest?.title} ${plan.dailyQuest?.description}`.toLowerCase()).toMatch(/private|questions|list/);
  });

  it("uses creator language for creator projects instead of SaaS-only language", () => {
    const creatorInput: UserOpportunityInput = {
      ...baseInput,
      interests: "content creation, YouTube",
      targetAudience: "small YouTubers",
      businessType: "content_business",
      existingIdea: "content idea tracker",
    };
    const report = createMockOpportunityReport(creatorInput);
    const plan = buildFounderQuestPlan({
      project: project({ report_json: report, business_type: "content_business" }),
      report,
      proof: { ...emptyProof, people_contacted: 5, replies: 3, pain_confirmed: 3 },
      now: new Date("2026-07-11T16:00:00.000Z"),
    });

    expect(plan.weeklyQuests.some((quest) => /content|publish|creators/i.test(`${quest.title} ${quest.description}`))).toBe(true);
    expect(plan.weeklyQuests.map((quest) => quest.title).join(" ")).not.toMatch(/SaaS/i);
  });

  it("marks evidence-record quests complete only when the proof target is reached", () => {
    const report = createMockOpportunityReport(baseInput);
    const plan = buildFounderQuestPlan({
      project: project({ report_json: report }),
      report,
      proof: { ...emptyProof, people_contacted: 5, replies: 1 },
      now: new Date("2026-07-11T16:00:00.000Z"),
    });

    const contactedQuest = plan.weeklyQuests.find((quest) => quest.targetType === "people_contacted");
    expect(contactedQuest?.verificationMethod).toBe("evidence_record");
    expect(contactedQuest?.done).toBe(true);
  });

  it("does not use OpenAI or require external data for routine quests", () => {
    const report = createMockOpportunityReport(baseInput);
    const plan = buildFounderQuestPlan({
      project: project({ report_json: report }),
      report,
      proof: emptyProof,
      now: new Date("2026-07-11T16:00:00.000Z"),
    });

    expect(JSON.stringify(plan).toLowerCase()).not.toContain("openai");
    expect(JSON.stringify(plan).toLowerCase()).not.toContain("tavily");
  });

  it("stops routine quests for paused, archived, or deleted projects", () => {
    const report = createMockOpportunityReport(baseInput);
    const pausedPlan = buildFounderQuestPlan({ project: project({ report_json: report, lifecycle_status: "paused" }), report, proof: emptyProof });
    const deletedPlan = buildFounderQuestPlan({ project: project({ report_json: report, lifecycle_status: "active", deleted_at: "2026-07-12T00:00:00Z" }), report, proof: emptyProof });
    expect(pausedPlan.dailyQuest).toBeNull(); expect(pausedPlan.weeklyQuests).toHaveLength(0); expect(deletedPlan.dailyQuest).toBeNull();
  });
});
