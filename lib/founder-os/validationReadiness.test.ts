import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "./reportFallback";
import { hasRecordedOutcome, routeValidationPath } from "./validationReadiness";
import type { BusinessType, UserOpportunityInput } from "./types";
import type { ProofSummary } from "@/lib/proof-board";

const baseInput: UserOpportunityInput = { interests: "student productivity", skills: "research, writing", budget: 100, timePerWeek: 8, targetAudience: "high school students preparing for difficult exams", businessType: "ai_tool", goal: "side_income", riskTolerance: 5, existingIdea: "A focused study planning assistant" };
const emptyProof: ProofSummary = { people_contacted: 0, replies: 0, pain_confirmed: 0, interested_users: 0, waitlist_signups: 0, payment_intent: 0, preorders_or_revenue_cents: 0, experiment_count: 0, confidence_score: 0, confidence_label: "No evidence yet", evidence_sentence: "No evidence collected yet.", recommended_next_action: "Start one test." };

function report(overrides: Partial<UserOpportunityInput> = {}) { return createMockOpportunityReport({ ...baseInput, ...overrides }); }
function route(input: { businessType?: BusinessType; idea?: string; preference?: Parameters<typeof routeValidationPath>[0]["preference"]; status?: "idea" | "validating" | "building" | "launched"; proof?: ProofSummary; experiments?: Parameters<typeof routeValidationPath>[0]["experiments"]; history?: Parameters<typeof routeValidationPath>[0]["pathHistory"] } = {}) {
  return routeValidationPath({ report: report({ businessType: input.businessType ?? "ai_tool", existingIdea: input.idea ?? baseInput.existingIdea }), status: input.status ?? "idea", proof: input.proof ?? emptyProof, preference: input.preference, experiments: input.experiments, pathHistory: input.history });
}

describe("flexible validation routing", () => {
  it("starts a well-defined new project with its highest-value problem test", () => {
    const result = route();
    expect(result.pathType).toBe("customer_discovery");
    expect(result.decision.reason).toBe("unresolved_assumption");
  });

  it("does not treat a planned experiment or AI-written hypothesis as evidence", () => {
    const planned = {
      status: "planned" as const,
      evidence_type: "landing_page_result",
      hypothesis: "Visitors will join the waitlist.",
      people_contacted: 0,
      replies: 0,
      pain_confirmed: 0,
      interested_users: 0,
      waitlist_signups: 0,
      payment_intent: 0,
      preorders_or_revenue_cents: 0,
    };

    expect(hasRecordedOutcome(planned)).toBe(false);
    expect(route({ experiments: [planned] }).pathType).not.toBe("pricing_test");
  });

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

  it("moves from problem evidence to a demand commitment instead of repeating discovery", () => {
    const proof = { ...emptyProof, people_contacted: 5, replies: 4, pain_confirmed: 3, experiment_count: 1 };
    const result = route({ proof });
    expect(result.pathType).toBe("waitlist_test");
    expect(result.firstAction.action).not.toContain("how they handle");
  });

  it("moves from a demand commitment to willingness-to-pay evidence", () => {
    const proof = { ...emptyProof, people_contacted: 5, replies: 4, pain_confirmed: 3, waitlist_signups: 2, experiment_count: 2 };
    const result = route({ proof });
    expect(result.pathType).toBe("pricing_test");
    expect(result.decision.factors.join(" ")).toContain("willingness to pay");
  });

  it("honors a recorded pricing decision only after its evidence prerequisite is met", () => {
    const proof = { ...emptyProof, people_contacted: 5, replies: 4, pain_confirmed: 3, experiment_count: 1 };
    const result = routeValidationPath({ report: report(), status: "validating", proof, decisions: [{ decision_type: "test_pricing", outcome: null, rationale: "Test the price with people who described this problem.", evidence_summary: null }] });
    expect(result.pathType).toBe("pricing_test");
    expect(result.decision.reason).toBe("founder_decision");
  });

  it("investigates a failed pricing test instead of repeating the same price ask", () => {
    const proof = { ...emptyProof, people_contacted: 8, replies: 4, pain_confirmed: 3, waitlist_signups: 2, experiment_count: 3 };
    const result = route({ proof, experiments: [{ status: "completed", evidence_type: "pricing_response", people_contacted: 3, replies: 2, learnings: "Prospects declined at the stated price." }] });
    expect(result.pathType).toBe("pricing_test");
    expect(result.title).toBe("Investigate the Pricing Result");
    expect(result.firstAction.action).toContain("change before retesting");
    expect(result.decision.avoidsRepeating).toBe(true);
  });

  it("resolves a contradicted assumption before progressing", () => {
    const proof = { ...emptyProof, people_contacted: 6, replies: 4, pain_confirmed: 3, waitlist_signups: 2, experiment_count: 2 };
    const result = routeValidationPath({ report: report(), status: "validating", proof, assumptions: [{ assumption_key: "demand_exists", status: "contradicted", statement: "Students will request access." }] });
    expect(result.pathType).toBe("waitlist_test");
    expect(result.decision.reason).toBe("contradictory_evidence");
  });

  it("does not let an active path override contradictory evidence", () => {
    const proof = { ...emptyProof, people_contacted: 6, replies: 4, pain_confirmed: 3, waitlist_signups: 2, experiment_count: 2 };
    const result = routeValidationPath({ report: report(), status: "validating", proof, forcedPath: "pricing_test", assumptions: [{ assumption_key: "demand_exists", status: "contradicted", statement: "Students will request access." }] });
    expect(result.pathType).toBe("waitlist_test");
  });

  it("uses a changed follow-up after an inconclusive demand test", () => {
    const proof = { ...emptyProof, people_contacted: 5, replies: 4, pain_confirmed: 3, experiment_count: 2 };
    const result = route({ proof, experiments: [{ status: "completed", evidence_type: "waitlist_signup", people_contacted: 4, replies: 1, learnings: "No one signed up." }] });
    expect(result.pathType).toBe("waitlist_test");
    expect(result.title).toBe("Investigate the Demand Result");
    expect(result.firstAction.action).toContain("change one concrete variable");
  });

  it("allows a project with payment evidence to progress to launch readiness", () => {
    const proof = { ...emptyProof, people_contacted: 8, replies: 5, pain_confirmed: 4, waitlist_signups: 2, payment_intent: 1, experiment_count: 3 };
    expect(route({ status: "building", proof }).pathType).toBe("launch_readiness");
  });

  it("does not repeat completed discovery when its evidence already supports the problem", () => {
    const proof = { ...emptyProof, people_contacted: 5, replies: 4, pain_confirmed: 3, experiment_count: 1 };
    const result = route({ proof, experiments: [{ status: "completed", evidence_type: "problem_interview", people_contacted: 5, replies: 4, pain_confirmed: 3, learnings: "The same workflow problem appeared repeatedly." }] });
    expect(result.pathType).toBe("waitlist_test");
  });

  it("keeps sparse project context in an honest clarification fallback", () => {
    const sparse = report(); sparse.summary.targetCustomer = "users"; sparse.summary.painPoint = "not sure"; sparse.mvpPlan.mustHaveFeatures = [];
    const result = routeValidationPath({ report: sparse, status: "idea", proof: emptyProof });
    expect(result.pathType).toBe("project_clarification");
    expect(result.decision.reason).toBe("missing_context");
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
