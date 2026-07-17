import { describe, expect, it } from "vitest";
import { extractWebOpportunity, inferCategory, inferDeadline, inferDomainTrust } from "./extract";

describe("web discovery extraction", () => {
  it("trusts government and university domains only by suffix", () => {
    expect(inferDomainTrust("energy.gov")).toBe("official");
    expect(inferDomainTrust("example.edu")).toBe("official");
    expect(inferDomainTrust("gov.evil.com")).toBe("unverified");
  });

  it("infers category and future deadline from page content", () => {
    expect(inferCategory("Founders can apply for a startup accelerator cohort")).toBe("accelerator");
    expect(inferCategory("Builders can submit to a startup pitch competition with a prize")).toBe("pitch_competition");
    expect(inferDeadline("Application deadline: August 15, 2027. Late materials not accepted.")).toBe("2027-08-15");
    expect(inferDeadline("The closing date is Friday, July 3, 2027 at 11:59 p.m. ET.")).toBe("2027-07-03");
    expect(inferDeadline("Apply by 2027/02/28 to be considered.")).toBe("2027-02-28");
  });

  it("auto-publishes high-confidence official opportunities", () => {
    const extracted = extractWebOpportunity({
      title: "New Jersey Student Founder Fellowship",
      url: "https://example.edu/student-founder-fellowship",
      snippet: "Founder fellowship for New Jersey student entrepreneurs.",
      rawContent: "New Jersey Student Founder Fellowship. This fellowship supports high school students building technology startups and AI tools. Eligible applicants must be residents of New Jersey and high school students. Application deadline: August 15, 2027. Students may apply online through the official application portal.",
      score: 0.9,
      query: "test",
    });
    expect(extracted.autoPublish).toBe(true);
    expect(extracted.category).toBe("founder_fellowship");
    expect(extracted.eligibilityRules.states).toEqual(["NJ"]);
    expect(extracted.eligibilityRules.student_statuses).toEqual(["high_school"]);
  });

  it("lets high-confidence candidates bypass softer publishing filters", () => {
    const extracted = extractWebOpportunity({
      title: "Founder Fellowship Application Program",
      url: "https://example.edu/founder-fellowship",
      snippet: "Founder fellowship application for student entrepreneurs.",
      rawContent: "Founder Fellowship Application Program. This founder fellowship supports student entrepreneurs building software and AI startups. Eligible applicants must be residents of New Jersey and college students, founders, or early-stage entrepreneurs. Applicants may apply through the official application portal. The program reviews submissions on a rolling basis and publishes eligibility requirements for applicants. Selected founders receive mentorship, startup workshops, customer discovery support, pitch preparation, and access to a founder network. The application asks applicants to submit their startup idea, target customer, current progress, and why the fellowship would help them move faster.",
      score: 0.93,
      query: "test",
    });

    expect(extracted.confidence).toBeGreaterThanOrEqual(85);
    expect(extracted.deadline).toBeNull();
    expect(extracted.autoPublish).toBe(true);
    expect(extracted.statusReason).toBe("High-confidence candidate auto-published");
  });
});
