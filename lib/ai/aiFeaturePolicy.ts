import "server-only";
import { getFeatureUsagePolicy, type FeatureUsageKey } from "@/lib/billing/featurePolicy";

export type AiFeatureKey = FeatureUsageKey;

export type AiFeatureDecision = {
  allowed: boolean;
  mode: "api" | "local";
  reason: string;
};

export function decideAiFeature(feature: AiFeatureKey): AiFeatureDecision {
  const policy = getFeatureUsagePolicy(feature);
  if (!policy.canUseOpenAI) {
    return { allowed: true, mode: "local", reason: "This feature is deterministic and does not need external AI." };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { allowed: true, mode: "local", reason: "OPENAI_API_KEY is missing; using PrismForge local fallback." };
  }

  if (process.env.DISABLE_OPENAI === "1") {
    return { allowed: true, mode: "local", reason: "OpenAI is disabled by environment; using local fallback." };
  }

  return { allowed: true, mode: "api", reason: "OpenAI is configured for this explicit user-triggered feature." };
}
