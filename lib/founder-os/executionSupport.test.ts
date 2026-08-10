import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "@/lib/founder-os/reportFallback";
import { summarizeProof } from "@/lib/proof-board";
import { buildExecutionSupport } from "./executionSupport";
import { routeValidationPath, type ValidationRoutingResult } from "./validationReadiness";

const input = {
  interests: "student learning",
  skills: "writing and research",
  budget: 0,
  timePerWeek: 4,
  targetAudience: "high school students preparing for difficult exams",
  businessType: "ai_tool" as const,
  goal: "side_income" as const,
  riskTolerance: 3,
  existingIdea: "A study planner that helps students choose what to revise next",
};
const report = createMockOpportunityReport(input);

function route(overrides: Partial<ValidationRoutingResult> = {}) {
  return { ...routeValidationPath({ report, status: "idea", proof: summarizeProof([]) }), ...overrides };
}

describe("Next Move execution support", () => {
  it("prepares customer discovery outreach, questions, and an evidence handoff", () => {
    const support = buildExecutionSupport({ report, status: "idea", proof: summarizeProof([]), route: route({ pathType: "customer_discovery" }) });
    expect(support.type).toBe("customer_discovery");
    expect(support.artifacts.map((item) => item.label)).toEqual(expect.arrayContaining(["Outreach message", "Conversation questions"]));
    expect(support.evidenceToRecord).toContain("Problem interview");
  });

  it("prepares a zero-budget demand test without paid ads", () => {
    const support = buildExecutionSupport({ report, status: "idea", proof: summarizeProof([]), route: route({ pathType: "waitlist_test" }) });
    expect(support.type).toBe("demand_test");
    expect(support.summary).toContain("No paid spend is assumed");
    expect(support.steps.map((item) => item.detail).join(" ")).toContain("not paid ads");
  });

  it("prepares a pricing-specific offer and willingness-to-pay script", () => {
    const support = buildExecutionSupport({ report, status: "validating", proof: summarizeProof([{ people_contacted: 5, replies: 4, pain_confirmed: 3, interested_users: 2 }]), route: route({ pathType: "pricing_test" }) });
    expect(support.type).toBe("pricing_test");
    expect(support.artifacts.map((item) => item.label)).toEqual(expect.arrayContaining(["Pricing hypothesis", "Willingness-to-pay questions"]));
  });

  it("changes the pricing follow-up rather than repeating the original pitch", () => {
    const prior = { title: "$15 price test", evidence_type: "pricing_response", people_contacted: 5, replies: 2, payment_intent: 0, preorders_or_revenue_cents: 0 } as never;
    const support = buildExecutionSupport({ report, status: "validating", proof: summarizeProof([prior]), experiments: [prior], route: route({ pathType: "pricing_test", decision: { reason: "inconclusive_result", factors: [], avoidsRepeating: true } }) });
    expect(support.changedVariable).toContain("narrow paid pilot");
    expect(support.summary).toContain("no payment signal");
  });

  it("uses disconfirming questions when evidence contradicts the problem assumption", () => {
    const support = buildExecutionSupport({ report, status: "idea", proof: summarizeProof([{ people_contacted: 4, replies: 4, pain_confirmed: 0 }]), route: route({ pathType: "customer_discovery", decision: { reason: "contradictory_evidence", factors: [], avoidsRepeating: true } }) });
    expect(support.type).toBe("contradiction_resolution");
    expect(support.changedVariable).toContain("disconfirming");
  });

  it("scopes a no-code prototype when technical ability is low", () => {
    const lowTechReport = createMockOpportunityReport({ ...input, businessType: "digital_product", skills: "community outreach and writing" });
    const support = buildExecutionSupport({ report: lowTechReport, status: "building", proof: summarizeProof([{ people_contacted: 5, replies: 4, pain_confirmed: 3 }]), route: route({ pathType: "prototype_test" }) });
    expect(support.type).toBe("prototype_test");
    expect(support.summary).toContain("No custom code is required");
    expect(support.steps.map((item) => item.detail).join(" ")).toContain("sketch");
  });

  it("keeps assistance separate from completing the Next Move", () => {
    const support = buildExecutionSupport({ report, status: "idea", proof: summarizeProof([]), route: route() });
    expect(support.executionMode).toBe("FOUNDER_ACTION");
    expect(support.doneWhen).toBeTruthy();
    expect(support.evidenceToRecord).toBeTruthy();
  });
});
