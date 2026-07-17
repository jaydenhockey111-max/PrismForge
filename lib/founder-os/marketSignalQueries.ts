import type { LiveIntelligenceInput } from "@/lib/founder-os/liveIntelligence";

export function buildMarketSignalQueries(input: LiveIntelligenceInput) {
  const competitor = input.competitors?.[0] ?? input.projectTitle;
  const hooks = input.contentHooks?.[0] ?? input.painPoint;

  return [
    `${input.targetCustomer} complaints about ${input.painPoint}`,
    `${input.businessType} competitors pricing complaints`,
    `${competitor} reviews complaints pricing`,
    `${input.painPoint} software too expensive`,
    `${input.targetCustomer} looking for simpler way to ${hooks}`,
    `${input.businessType} Product Hunt launch`,
    `${input.projectTitle} niche TikTok trend`,
  ].slice(0, 5);
}
