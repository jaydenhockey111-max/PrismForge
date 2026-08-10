import { describe, expect, it } from "vitest";
import { getExecutionPolicy, canContinueExecution } from "@/lib/execution/policy";
import { buildMarketResearchContext, isMarketResearchEligible, sourceUrlsFromSteps, validateMarketResearchResult } from "@/lib/execution/marketResearch";
import type { OpportunityReport } from "@/lib/founder-os/types";

const report = {
  summary: { title: "Focused study planner", oneSentenceIdea: "A weekly study planning tool", targetCustomer: "college students", painPoint: "planning study time", whyNow: "", whyThisCouldMakeMoney: "", businessModel: "subscription" },
  competitors: [{ name: "Notion", whatTheyDo: "", strength: "", weakness: "", pricing: "", opportunityGap: "" }],
} as unknown as OpportunityReport;

describe("market research execution", () => {
  it("only makes the canonical private-research next move executable", () => {
    expect(isMarketResearchEligible({ routeKey: "private_research", executionMode: "AI_EXECUTABLE", report })).toBe(true);
    expect(isMarketResearchEligible({ routeKey: "customer_discovery", executionMode: "AI_EXECUTABLE", report })).toBe(false);
    expect(isMarketResearchEligible({ routeKey: "private_research", executionMode: "FOUNDER_ACTION", report })).toBe(false);
  });

  it("keeps execution context limited to the project, current move, and prior research", () => {
    const context = buildMarketResearchContext({ report, nextMove: { title: "Review alternatives", why: "Need clearer language", evidenceToRecord: "Sources", routeKey: "private_research", uncertainty: "Students struggle to plan." }, priorResearch: ["Previous note"] });
    expect(context.project.audience).toBe("college students");
    expect(context.existingKnowledge.competitors).toEqual(["Notion"]);
    expect(context.existingKnowledge.priorResearch).toEqual(["Previous note"]);
  });

  it("rejects fabricated or uncited findings", () => {
    const value = {
      researchQuestion: "What alternatives exist?", conciseAnswer: "Alternatives are documented.", competitors: [],
      findings: [{ finding: "A documented observation.", sourceUrls: ["https://example.com/known"] }],
      implicationsForNextMove: ["Ask a founder interview question."], uncertainties: ["This is secondary research."], recommendedFounderInterpretation: "Use it as preparation.",
      sources: [{ url: "https://example.com/known", title: "Known source", sourceType: "official" }],
    };
    expect(() => validateMarketResearchResult(value, ["https://example.com/known"], "execution-1")).not.toThrow();
    expect(() => validateMarketResearchResult({ ...value, findings: [{ ...value.findings[0], sourceUrls: ["https://example.com/fabricated"] }] }, ["https://example.com/known"], "execution-1")).toThrow(/not collected/);
  });

  it("retains only inspectable HTTP source URLs and stops at tool limits", () => {
    expect(sourceUrlsFromSteps([{ sources: [{ type: "url", url: "https://example.com/a" }, { type: "url", url: "javascript:alert(1)" }] }])).toEqual(["https://example.com/a"]);
    const policy = getExecutionPolicy("market_research");
    if (!policy) throw new Error("expected policy");
    expect(canContinueExecution({ policy, reservedBudgetUsd: policy.maxBudgetUsd, actualCostUsd: 0, modelCalls: 0, toolCalls: policy.maxToolCalls, retries: 0, steps: 0, startedAt: Date.now(), nextEstimatedCostUsd: 0.01 })).toEqual({ allowed: false, reason: "TOOL_LIMIT" });
  });
});
