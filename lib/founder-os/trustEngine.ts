import type { Competitor, OpportunityReport, OpportunityScore, OpportunitySubScore } from "@/lib/founder-os/types";

export type TrustLabel =
  | "verified_fact"
  | "user_provided"
  | "project_structure"
  | "hypothesis"
  | "assumption"
  | "evidence"
  | "needs_validation";

export type TrustFindingCategory =
  | "unsupported_certainty"
  | "fake_statistic"
  | "fake_research"
  | "fake_quote"
  | "fake_validation"
  | "fake_competition"
  | "fake_revenue"
  | "fake_market_data";

export type TrustFinding = {
  category: TrustFindingCategory;
  phrase: string;
};

const UNSUPPORTED_CERTAINTY_PATTERNS: Array<{ pattern: RegExp; category: TrustFindingCategory }> = [
  { pattern: /\b(research shows|studies show|data shows|market analysis indicates)\b/i, category: "fake_research" },
  { pattern: /\b(customers say|customers report|users say|users report|users complain|customers complain)\b/i, category: "fake_quote" },
  { pattern: /\b(validated|proven|confirmed|guaranteed)\b/i, category: "fake_validation" },
  { pattern: /\b(market signal|demand signal|search demand is|demand is strong|demand is up|strong demand|market demand|the market wants)\b/i, category: "fake_market_data" },
  { pattern: /\b(industry standard|competitors are weak|competitors lack|competition is low)\b/i, category: "fake_competition" },
  { pattern: /\b(revenue is likely|will pay|will buy|willing to pay)\b/i, category: "fake_revenue" },
  { pattern: /\b(ai confidence|validation score|demand score|competition score|market score)\b/i, category: "unsupported_certainty" },
];

const STATISTIC_PATTERN = /(?:\b\d+(?:\.\d+)?%|\$\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:\.\d+)?x\b|\b(?:cagr|tam|sam|som|market size|million|billion)\b)/i;
const TRUST_PREFIX_PATTERN = /^(hypothesis|assumption|needs validation|evidence collected|verified|project structure|user-provided|no evidence collected yet)\b/i;

export function trustBadgeLabel(label: TrustLabel) {
  const labels: Record<TrustLabel, string> = {
    verified_fact: "Verified",
    user_provided: "User-provided",
    project_structure: "Project structure",
    hypothesis: "Hypothesis",
    assumption: "Assumption",
    evidence: "Evidence collected",
    needs_validation: "Needs validation",
  };
  return labels[label];
}

export function classifyTrustStatement(value: string, options: { evidenceBacked?: boolean; userProvided?: boolean } = {}): TrustLabel {
  const text = normalizeWhitespace(value);
  if (!text) return "needs_validation";
  if (options.evidenceBacked) return "evidence";
  if (options.userProvided) return "user_provided";
  if (/^no evidence collected yet/i.test(text)) return "needs_validation";
  if (/^hypothesis/i.test(text)) return "hypothesis";
  if (/^assumption/i.test(text)) return "assumption";
  if (detectTrustFindings(text).length) return "hypothesis";
  return "project_structure";
}

export function detectTrustFindings(value: string, options: { evidenceBacked?: boolean; allowPricing?: boolean } = {}): TrustFinding[] {
  if (options.evidenceBacked) return [];
  const text = normalizeWhitespace(value);
  if (!text) return [];

  const findings: TrustFinding[] = [];
  for (const { pattern, category } of UNSUPPORTED_CERTAINTY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) findings.push({ category, phrase: match[0] });
  }

  if (!options.allowPricing && STATISTIC_PATTERN.test(text)) {
    findings.push({ category: "fake_statistic", phrase: text.match(STATISTIC_PATTERN)?.[0] ?? "numeric claim" });
  }

  return dedupeFindings(findings);
}

export function sanitizeTrustText(
  value: string,
  options: {
    label?: TrustLabel;
    evidenceBacked?: boolean;
    allowPricing?: boolean;
    fallback?: string;
  } = {},
) {
  const fallback = options.fallback ?? "No evidence collected yet.";
  const text = normalizeWhitespace(value) || fallback;
  if (options.evidenceBacked) return text;

  const findings = detectTrustFindings(text, { allowPricing: options.allowPricing });
  let cleaned = text
    .replace(/\b(research shows|studies show|data shows|market analysis indicates)\b/gi, "A hypothesis to test is that")
    .replace(/\b(customers say|customers report|users say|users report|users complain|customers complain)\b/gi, "Potential customer interviews should test whether")
    .replace(/\b(validated|proven|confirmed)\b/gi, "unverified")
    .replace(/\bguaranteed\b/gi, "not guaranteed")
    .replace(/\bthe market wants\b/gi, "the target audience may want")
    .replace(/\bdemand is strong\b/gi, "demand may exist")
    .replace(/\bdemand is up\b/gi, "demand may be changing")
    .replace(/\bstrong demand\b/gi, "possible demand")
    .replace(/\bmarket signal\b/gi, "hypothesis")
    .replace(/\bdemand signal\b/gi, "hypothesis")
    .replace(/\bcompetition is low\b/gi, "competition still needs research")
    .replace(/\bcompetitors are weak\b/gi, "some alternatives may leave gaps")
    .replace(/\bwill pay\b/gi, "may pay if validated")
    .replace(/\bwill buy\b/gi, "may buy if validated");

  const label = options.label ?? (findings.length ? "hypothesis" : "project_structure");
  if (label !== "project_structure" && !TRUST_PREFIX_PATTERN.test(cleaned)) {
    cleaned = `${trustBadgeLabel(label)}: ${lowercaseFirst(cleaned)}`;
  }

  return cleaned;
}

export function sanitizeTrustList(values: string[], label: TrustLabel, options: { allowPricing?: boolean } = {}) {
  return values.map((value) => sanitizeTrustText(value, { label, allowPricing: options.allowPricing }));
}

export function sanitizeOpportunityReportTrust(report: OpportunityReport): { report: OpportunityReport; findings: TrustFinding[] } {
  const findings: TrustFinding[] = [];
  const collect = (value: string, options?: { allowPricing?: boolean }) => findings.push(...detectTrustFindings(value, options));

  const score = sanitizeScore(report.score);
  score.breakdown.forEach((item) => collect(item.explanation));

  const summary = {
    ...report.summary,
    whyNow: sanitizeTrustText(report.summary.whyNow, { label: "assumption" }),
    whyThisCouldMakeMoney: sanitizeTrustText(report.summary.whyThisCouldMakeMoney, { label: "hypothesis" }),
  };

  const marketValidation = {
    searchDemandAssumptions: sanitizeTrustList(report.marketValidation.searchDemandAssumptions, "hypothesis"),
    socialDemandAssumptions: sanitizeTrustList(report.marketValidation.socialDemandAssumptions, "hypothesis"),
    competitorLandscape: "No verified competitive research has been recorded yet. Treat alternatives below as hypotheses to investigate.",
    existingAlternatives: sanitizeLikelyAlternatives(report.marketValidation.existingAlternatives),
    userComplaints: report.marketValidation.userComplaints.map((item) =>
      sanitizeTrustText(item, {
        label: "hypothesis",
        fallback: "Interview target customers to learn what actually frustrates them.",
      }).replace(/^Hypothesis:\s*/i, "Hypothesis to validate in interviews: "),
    ),
    underservedAngle: sanitizeTrustText(report.marketValidation.underservedAngle, { label: "hypothesis" }),
    confidenceNotes: ensureNoEvidenceNote(sanitizeTrustList(report.marketValidation.confidenceNotes, "needs_validation")),
  };
  [
    ...report.marketValidation.searchDemandAssumptions,
    ...report.marketValidation.socialDemandAssumptions,
    report.marketValidation.competitorLandscape,
    ...report.marketValidation.existingAlternatives,
    ...report.marketValidation.userComplaints,
    report.marketValidation.underservedAngle,
    ...report.marketValidation.confidenceNotes,
  ].forEach((value) => collect(value));

  const competitors = report.competitors.map(sanitizeCompetitor);
  competitors.forEach((competitor) => {
    collect(competitor.whatTheyDo);
    collect(competitor.strength);
    collect(competitor.weakness);
    collect(competitor.opportunityGap);
  });

  const landingPageCopy = {
    ...report.landingPageCopy,
    socialProofPlaceholder: "No customer proof collected yet. Add real quotes only after users provide them.",
  };
  collect(report.landingPageCopy.socialProofPlaceholder);

  return {
    report: {
      ...report,
      score,
      summary,
      marketValidation,
      competitors,
      landingPageCopy,
    },
    findings: dedupeFindings(findings),
  };
}

function sanitizeScore(score: OpportunityScore): OpportunityScore {
  const labelMap: Partial<Record<OpportunitySubScore["key"], string>> = {
    demand: "Demand hypothesis",
    competition: "Competitive hypothesis",
    monetization: "Monetization hypothesis",
    easeOfMvp: "MVP structure",
    virality: "Content hypothesis",
    founderFit: "Founder fit",
    recurringRevenue: "Recurring habit hypothesis",
  };

  return {
    ...score,
    breakdown: score.breakdown.map((item) => ({
      ...item,
      label: labelMap[item.key] ?? item.label,
      explanation: sanitizeTrustText(item.explanation, { label: item.key === "founderFit" || item.key === "easeOfMvp" ? "project_structure" : "hypothesis" }),
    })),
  };
}

function sanitizeLikelyAlternatives(values: string[]) {
  return values.map((value) => {
    const text = sanitizeTrustText(value, { label: "hypothesis", allowPricing: true });
    return text.replace(/^Hypothesis:\s*/i, "Likely alternative/workaround to research: ");
  });
}

function sanitizeCompetitor(competitor: Competitor): Competitor {
  return {
    ...competitor,
    name: sanitizeCompetitorName(competitor.name),
    whatTheyDo: sanitizeTrustText(competitor.whatTheyDo, { label: "hypothesis" }),
    strength: sanitizeTrustText(competitor.strength, { label: "hypothesis" }),
    weakness: sanitizeTrustText(competitor.weakness, { label: "hypothesis" }),
    pricing: sanitizeTrustText(competitor.pricing, { label: "assumption", allowPricing: true }),
    opportunityGap: sanitizeTrustText(competitor.opportunityGap, { label: "hypothesis" }),
  };
}

function sanitizeCompetitorName(name: string) {
  const text = normalizeWhitespace(name);
  if (/^likely alternative/i.test(text)) return text;
  return `Likely alternative: ${text}`;
}

function ensureNoEvidenceNote(values: string[]) {
  const noEvidence = "No evidence collected yet. Treat market demand, customer pain, pricing, and competition as hypotheses until real users respond, join, or pay.";
  const withoutCertainty = values.map((value) => value.replace(/\bconfidence\b/gi, "trust"));
  if (withoutCertainty.some((value) => /no evidence collected yet/i.test(value))) return withoutCertainty;
  return [noEvidence, ...withoutCertainty].slice(0, 8);
}

function dedupeFindings(findings: TrustFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.category}:${finding.phrase.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeWhitespace(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lowercaseFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}
