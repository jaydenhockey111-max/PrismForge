import { describe, expect, it } from "vitest";
import { getNextBestActionDetail } from "./projectAlpha";
import type { ProofSummary } from "@/lib/proof-board";

describe("Project Alpha next best action", () => {
  it("starts with Proof Board when no experiment exists", () => {
    const action = getNextBestActionDetail({ status: "idea", proof: summary({ experiment_count: 0 }) });
    expect(action.area).toBe("Proof Board");
    expect(action.action).toContain("first validation experiment");
  });

  it("routes weak outreach to the Outreach Kit", () => {
    const action = getNextBestActionDetail({ status: "validating", proof: summary({ experiment_count: 1, people_contacted: 10, replies: 1 }) });
    expect(action.area).toBe("Outreach Kit");
    expect(action.action).toContain("Improve your outreach");
  });

  it("routes payment-intent work to First Dollar Sprint", () => {
    const action = getNextBestActionDetail({ status: "validating", proof: summary({ experiment_count: 1, people_contacted: 10, replies: 5, pain_confirmed: 3, interested_users: 2, waitlist_signups: 2, payment_intent: 0 }) });
    expect(action.area).toBe("First Dollar Sprint");
    expect(action.action).toContain("willingness to pay");
  });

  it("routes strong payment signal to launch planning", () => {
    const action = getNextBestActionDetail({ status: "building", proof: summary({ experiment_count: 1, people_contacted: 10, replies: 5, pain_confirmed: 3, interested_users: 2, waitlist_signups: 1, payment_intent: 1 }) });
    expect(action.area).toBe("Launch Command Center");
    expect(action.action).toContain("Strong signal");
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
    experiment_count: 1,
    confidence_score: 0,
    confidence_label: "No evidence yet",
    evidence_sentence: "",
    recommended_next_action: "",
    ...overrides,
  };
}
