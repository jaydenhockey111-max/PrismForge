import { describe, expect, it } from "vitest";
import { getFirstDollarDecision, getRevenueSignal } from "./firstDollarSprint";
import type { ProofSummary } from "@/lib/proof-board";

describe("First Dollar Sprint rules", () => {
  it("classifies revenue signals from proof metrics", () => {
    expect(getRevenueSignal(summary()).label).toBe("No signal");
    expect(getRevenueSignal(summary({ waitlist_signups: 1 })).label).toBe("Weak signal");
    expect(getRevenueSignal(summary({ payment_intent: 2 })).label).toBe("Promising signal");
    expect(getRevenueSignal(summary({ preorders_or_revenue_cents: 100 })).label).toBe("Strong signal");
  });

  it("recommends the right payment validation decision", () => {
    expect(getFirstDollarDecision(summary())).toContain("asking 10 people");
    expect(getFirstDollarDecision(summary({ people_contacted: 10, replies: 0 }))).toContain("message or audience");
    expect(getFirstDollarDecision(summary({ replies: 3, pain_confirmed: 0 }))).toContain("problem may be weak");
    expect(getFirstDollarDecision(summary({ pain_confirmed: 3, payment_intent: 0 }))).toContain("Ask interested users");
    expect(getFirstDollarDecision(summary({ payment_intent: 1 }))).toContain("Payment signal exists");
  });
});

function summary(overrides: Partial<ProofSummary> = {}): ProofSummary {
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
