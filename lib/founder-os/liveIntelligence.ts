import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";

export type MarketSignalCategory = "Competitor" | "Demand" | "Social" | "Pricing" | "Launch" | "Risk" | "Action";
export type MarketSignalSeverity = "Low" | "Medium" | "High";

export type MarketSignal = {
  id: string;
  title: string;
  category: MarketSignalCategory;
  severity: MarketSignalSeverity;
  confidence: number;
  explanation: string;
  suggestedAction: string;
  sourceLabel: string;
  updatedAt: string;
};

export type LiveIntelligenceSummary = {
  totalSignals: number;
  highestSeverity: MarketSignalSeverity;
  averageConfidence: number;
  lastChecked: string;
  statusLabel: string;
  dailyBrief: string;
};

export type LiveIntelligenceInput = {
  projectTitle: string;
  businessType: BusinessType;
  targetCustomer: string;
  painPoint: string;
  competitors?: string[];
  pricingPlan?: string;
  contentHooks?: string[];
  mvpFeatures?: string[];
  status: ProjectStatus;
  score?: number | null;
  report?: OpportunityReport;
};

export type LiveIntelligenceResult = {
  signals: MarketSignal[];
  summary: LiveIntelligenceSummary;
};

export function buildLiveIntelligenceInput(input: {
  projectTitle: string;
  businessType: BusinessType;
  targetCustomer: string;
  status: ProjectStatus;
  score?: number | null;
  report: OpportunityReport;
}): LiveIntelligenceInput {
  return {
    projectTitle: input.projectTitle,
    businessType: input.businessType,
    targetCustomer: input.targetCustomer || input.report.summary?.targetCustomer || "your target customer",
    painPoint: input.report.summary?.painPoint || "the core customer pain",
    competitors: input.report.competitors?.map((competitor) => competitor.name).filter(Boolean).slice(0, 3),
    pricingPlan: input.report.monetizationPlan?.suggestedPrice,
    contentHooks: input.report.contentPlan?.shortFormHooks?.slice(0, 3),
    mvpFeatures: input.report.mvpPlan?.mustHaveFeatures?.slice(0, 3) ?? input.report.mvpPlan?.featureList?.slice(0, 3),
    status: input.status,
    score: input.score ?? input.report.score?.overall,
    report: input.report,
  };
}

export function summarizeSignals(signals: MarketSignal[], lastChecked: string): LiveIntelligenceSummary {
  const severityRank: Record<MarketSignalSeverity, number> = { Low: 1, Medium: 2, High: 3 };
  const highestSeverity = signals.reduce<MarketSignalSeverity>((highest, signal) => severityRank[signal.severity] > severityRank[highest] ? signal.severity : highest, "Low");
  const averageConfidence = signals.length ? Math.round(signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length) : 0;
  const topSignal = signals[0];

  return {
    totalSignals: signals.length,
    highestSeverity,
    averageConfidence,
    lastChecked,
    statusLabel: signals.length ? "Local Market Pulse preview ready" : "Awaiting local preview",
    dailyBrief: topSignal
      ? `${topSignal.title} ${topSignal.suggestedAction}`
      : "Refresh the local Market Pulse preview to generate founder intelligence for this project.",
  };
}
