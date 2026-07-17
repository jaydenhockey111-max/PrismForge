import { describe, expect, it } from "vitest";
import { rankOpportunities, scoreOpportunity } from "./matching";
import type { Opportunity, Profile } from "./database.types";

const profile = {
  id: "user-1", email: "test@example.com", name: "Alex", age: 17, state: "NJ",
  income_range: "25k_50k", student_status: "high_school", occupation: "Student",
  interests: ["Science", "Technology"], role: "user", plan: "free", stripe_customer_id: null,
  beta_access_until: null, lifetime_founder: false, beta_feedback_completed: false, beta_feedback_completed_at: null,
  alerts_enabled: true, onboarding_completed: true, goals: null, resume_link: null, education_level: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
} satisfies Profile;

const opportunity = {
  id: "opp-1", title: "Student Founder Fellowship", description: "A qualifying founder fellowship for student builders.", deadline: "2099-01-01",
  category: "founder_fellowship", eligibility_rules: { states: ["NJ"], max_age: 18, student_statuses: ["high_school"] },
  url: "https://example.com", status: "published", created_by: null, created_at: "2026-01-01", updated_at: "2026-01-01",
  source_name: "manual", source_id: null, source_url: null, source_updated_at: null,
  first_seen_at: "2026-01-01", last_seen_at: "2026-01-01", eligibility_summary: null,
  review_status: "approved", checksum: null, raw_data: null, estimated_value: 2500,
} satisfies Opportunity;

describe("matching engine", () => {
  it("returns 100 when all eligibility rules match", () => {
    expect(scoreOpportunity(profile, opportunity).score).toBe(100);
  });

  it("weights and reports a missed rule", () => {
    const result = scoreOpportunity({ ...profile, state: "NY" }, opportunity);
    expect(result.score).toBe(67);
    expect(result.missedRules).toContain("Location");
  });

  it("removes expired opportunities", () => {
    expect(rankOpportunities(profile, [{ ...opportunity, deadline: "2020-01-01" }])).toHaveLength(0);
  });

  it("boosts matches when a saved founder project fits program rules", () => {
    const project = { id: "p1", title: "AI founder funding assistant", business_type: "ai_tool" as const, target_customer: "students", score: 88, status: "validating" as const };
    const result = scoreOpportunity(profile, { ...opportunity, eligibility_rules: { business_types: ["ai_tool"], min_project_score: 75 } }, [project]);
    expect(result.score).toBe(100);
    expect(result.project?.id).toBe("p1");
  });
});
