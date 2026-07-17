import { describe, expect, it } from "vitest";
import { createMockOpportunityReport } from "./reportFallback";
import {
  classifyTrustStatement,
  detectTrustFindings,
  sanitizeOpportunityReportTrust,
  sanitizeTrustText,
} from "./trustEngine";
import type { UserOpportunityInput } from "./types";

const input: UserOpportunityInput = {
  interests: "content creation, AI tools",
  skills: "writing, sales",
  budget: 100,
  timePerWeek: 8,
  targetAudience: "Small YouTubers",
  businessType: "ai_tool",
  goal: "side_income",
  riskTolerance: 5,
  existingIdea: "Content idea tracker",
};

describe("PrismForge Trust Engine", () => {
  it("classifies unsupported certainty as a hypothesis", () => {
    expect(classifyTrustStatement("Research shows users report strong demand.")).toBe("hypothesis");
  });

  it("detects fake research, fake quotes, and unsupported statistics", () => {
    const findings = detectTrustFindings("Research shows users complain and demand is up 40%.");

    expect(findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(["fake_research", "fake_quote", "fake_market_data", "fake_statistic"]),
    );
  });

  it("rewrites unsupported market claims into clearly labeled hypotheses", () => {
    const sanitized = sanitizeTrustText("Research shows users complain this market has strong demand.", { label: "hypothesis" });

    expect(sanitized).toMatch(/^Hypothesis:/);
    expect(sanitized).not.toMatch(/research shows|users complain|strong demand/i);
  });

  it("keeps user-provided facts separate from generated proof", () => {
    expect(classifyTrustStatement("Small YouTubers", { userProvided: true })).toBe("user_provided");
  });

  it("sanitizes generated reports before they are saved", () => {
    const report = createMockOpportunityReport(input);
    report.marketValidation.competitorLandscape = "Research shows competitors are weak and demand is strong.";
    report.marketValidation.userComplaints = ["Users report they hate existing tools."];
    report.landingPageCopy.socialProofPlaceholder = "Customers say this saves 3 hours/week.";

    const result = sanitizeOpportunityReportTrust(report);
    const serialized = JSON.stringify(result.report).toLowerCase();

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.report.marketValidation.competitorLandscape).toMatch(/No verified competitive research/);
    expect(result.report.marketValidation.userComplaints[0]).toMatch(/Hypothesis/);
    expect(result.report.landingPageCopy.socialProofPlaceholder).toMatch(/No customer proof collected yet/);
    expect(serialized).not.toMatch(/research shows|users report|customers say|demand is strong/);
  });
});
