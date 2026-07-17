import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "./reportFallback";
import { routeValidationPath } from "./validationReadiness";
import type { BusinessType, UserOpportunityInput } from "./types";
import type { ProofSummary } from "@/lib/proof-board";

const baseInput: UserOpportunityInput = { interests: "student productivity", skills: "research, writing", budget: 100, timePerWeek: 8, targetAudience: "high school students preparing for difficult exams", businessType: "ai_tool", goal: "side_income", riskTolerance: 5, existingIdea: "A focused study planning assistant" };
const emptyProof: ProofSummary = { people_contacted: 0, replies: 0, pain_confirmed: 0, interested_users: 0, waitlist_signups: 0, payment_intent: 0, preorders_or_revenue_cents: 0, experiment_count: 0, confidence_score: 0, confidence_label: "No evidence yet", evidence_sentence: "No evidence collected yet.", recommended_next_action: "Start one test." };

function report(overrides: Partial<UserOpportunityInput> = {}) { return createMockOpportunityReport({ ...baseInput, ...overrides }); }
function route(input: { businessType?: BusinessType; idea?: string; preference?: Parameters<typeof routeValidationPath>[0]["preference"]; status?: "idea" | "validating" | "building" | "launched"; proof?: ProofSummary; experiments?: Parameters<typeof routeValidationPath>[0]["experiments"]; history?: Parameters<typeof routeValidationPath>[0]["pathHistory"] } = {}) {
  return routeValidationPath({ report: report({ businessType: input.businessType ?? "ai_tool", existingIdea: input.idea ?? baseInput.existingIdea }), status: input.status ?? "idea", proof: input.proof ?? emptyProof, preference: input.preference, experiments: input.experiments, pathHistory: input.history });
}

describe("flexible validation routing", () => {
  it("clarifies an underspecified project without forcing outreach", () => {
    const unclear = report(); unclear.summary.targetCustomer = "users"; unclear.summary.painPoint = "idk";
    const result = routeValidationPath({ report: unclear, status: "idea", proof: emptyProof });
    expect(result.pathType).toBe("project_clarification"); expect(result.firstAction.action).toContain("specific audience");
  });

  it("honors private research as a bounded first step", () => {
    const result = route({ preference: "private_research_first" });
    expect(result.pathType).toBe("private_research"); expect(result.alternatives.length).toBeLessThanOrEqual(2);
  });

  it("routes a service project to a narrow pilot", () => {
    expect(route({ businessType: "local_service", idea: "A local bookkeeping service for independent restaurant owners" }).pathType).toBe("service_pilot");
  });

  it("tests marketplace supply before demand", () => {
    expect(route({ idea: "A two-sided marketplace connecting youth sports coaches and families" }).pathType).toBe("marketplace_supply_test");
  });

  it("uses a content response path for creator businesses", () => {
    const creatorReport = report({ businessType: "content_business", interests: "creator growth, newsletters", existingIdea: "A creator content brand and newsletter for independent YouTube creators", targetAudience: "independent YouTube creators building their first audience" });
    expect(routeValidationPath({ report: creatorReport, status: "idea", proof: emptyProof }).pathType).toBe("content_test");
  });

  it("uses physical feedback before spending on a physical concept", () => {
    expect(route({ businessType: "e_commerce", idea: "A physical hardware training aid for hockey players" }).pathType).toBe("physical_product_test");
  });

  it("respects a concrete prototype preference", () => {
    expect(route({ preference: "need_something_concrete" }).pathType).toBe("prototype_test");
  });

  it("does not route to pricing until problem evidence exists", () => {
    expect(route({ preference: "test_pricing" }).pathType).not.toBe("pricing_test");
    const proof = { ...emptyProof, people_contacted: 5, replies: 3, pain_confirmed: 2, experiment_count: 1, confidence_score: 50, confidence_label: "Promising signal" as const };
    expect(route({ preference: "test_pricing", proof }).pathType).toBe("pricing_test");
  });

  it("moves launched projects to post-launch learning", () => {
    expect(route({ status: "launched" }).pathType).toBe("post_launch_learning");
  });

  it("triggers anti-avoidance after repeated preparation without external evidence", () => {
    const history = [
      { path_type: "project_clarification" as const, status: "completed" as const },
      { path_type: "private_research" as const, status: "completed" as const },
      { path_type: "prototype_test" as const, status: "completed" as const },
    ];
    const result = route({ history });
    expect(result.pathType).toBe("customer_discovery"); expect(result.avoidanceGuard).toContain("outside the project");
  });

  it("marks a completed evidence-specific path complete", () => {
    const result = route({ preference: "private_research_first", experiments: [{ evidence_type: "research_pattern", status: "completed", learnings: "Three sources repeated the same painful workflow." }] });
    expect(result.progress).toBe(100); expect(result.complete).toBe(true);
  });
});
