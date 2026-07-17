import { describe, expect, it } from "vitest";
import { computeValidationConfidence, recommendNextAction, validationExperimentInputSchema } from "./proof-board";

describe("Proof Board rules", () => {
  it("computes validation confidence from real-world evidence", () => {
    expect(computeValidationConfidence({ people_contacted: 10, replies: 4, pain_confirmed: 3, interested_users: 2, waitlist_signups: 1, payment_intent: 1 })).toBe(100);
    expect(computeValidationConfidence({ people_contacted: 10, replies: 0 })).toBe(15);
  });

  it("recommends next action from evidence gaps", () => {
    expect(recommendNextAction({ people_contacted: 0 })).toContain("contacting 10 people");
    expect(recommendNextAction({ people_contacted: 10, replies: 1 })).toContain("outreach message");
    expect(recommendNextAction({ people_contacted: 10, replies: 5, pain_confirmed: 3, payment_intent: 0 })).toContain("willingness to pay");
    expect(recommendNextAction({ people_contacted: 10, replies: 5, pain_confirmed: 3, payment_intent: 1 })).toContain("paid beta");
  });

  it("rejects negative metrics", () => {
    const result = validationExperimentInputSchema.safeParse({
      title: "Bad metrics",
      people_contacted: -1,
      replies: 0,
      pain_confirmed: 0,
      interested_users: 0,
      waitlist_signups: 0,
      payment_intent: 0,
      preorders_or_revenue_cents: 0,
    });
    expect(result.success).toBe(false);
  });
});
