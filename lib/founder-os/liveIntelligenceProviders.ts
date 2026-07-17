import { buildMarketSignalQueries } from "@/lib/founder-os/marketSignalQueries";
import { summarizeSignals, type LiveIntelligenceInput, type LiveIntelligenceResult, type MarketSignal } from "@/lib/founder-os/liveIntelligence";

export function generateMockMarketSignals(input: LiveIntelligenceInput, checkedAt = new Date().toISOString()): LiveIntelligenceResult {
  const queries = buildMarketSignalQueries(input);
  const competitor = input.competitors?.[0] ?? "an adjacent competitor";
  const firstHook = input.contentHooks?.[0] ?? input.painPoint;
  const firstFeature = input.mvpFeatures?.[0] ?? "the smallest useful MVP flow";

  const signals: MarketSignal[] = [
    {
      id: "customer-pain",
      title: `${input.targetCustomer} are still describing the pain in plain language.`,
      category: "Demand",
      severity: input.score && input.score >= 75 ? "Medium" : "High",
      confidence: confidence(`${input.projectTitle}:demand`, 78, 92),
      explanation: `Mock scan pattern based on query: "${queries[0]}". The project should keep validating the exact words users use for "${input.painPoint}".`,
      suggestedAction: "Run five short pain interviews before adding new scope.",
      sourceLabel: "Local Market Pulse",
      updatedAt: checkedAt,
    },
    {
      id: "pricing-complaint",
      title: `Pricing/friction complaints are a useful wedge against ${competitor}.`,
      category: "Pricing",
      severity: "Medium",
      confidence: confidence(`${input.projectTitle}:pricing`, 66, 86),
      explanation: `Future search query template: "${queries[1]}". Use pricing complaints to shape a simpler first offer.`,
      suggestedAction: `Position the MVP around ${firstFeature} before expanding tiers.`,
      sourceLabel: "Local Market Pulse",
      updatedAt: checkedAt,
    },
    {
      id: "social-hook",
      title: "Short-form content can test demand before the full launch.",
      category: "Social",
      severity: "Low",
      confidence: confidence(`${input.projectTitle}:social`, 62, 82),
      explanation: `A launch hook already exists: "${firstHook}". This can become a TikTok/Reels/Shorts test before private alpha.`,
      suggestedAction: "Post one proof-driven clip and ask viewers what part feels most painful.",
      sourceLabel: "Local Market Pulse",
      updatedAt: checkedAt,
    },
    {
      id: "launch-window",
      title: input.status === "building" || input.status === "launched" ? "Launch window is opening." : "Validation should come before launch polish.",
      category: input.status === "building" || input.status === "launched" ? "Launch" : "Risk",
      severity: input.status === "idea" ? "High" : "Medium",
      confidence: confidence(`${input.projectTitle}:launch`, 70, 90),
      explanation: `Project status is ${input.status}. Market Pulse is project-scoped and should inform what to validate, build, or launch next.`,
      suggestedAction: input.status === "idea" ? "Validate the pain with real people first." : "Invite a small tester batch and collect feedback fast.",
      sourceLabel: "Founder Intelligence",
      updatedAt: checkedAt,
    },
  ];

  return {
    signals,
    summary: summarizeSignals(signals, checkedAt),
  };
}

function confidence(seed: string, min: number, max: number) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return min + (hash % (max - min + 1));
}
