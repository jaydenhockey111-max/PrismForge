import "server-only";
import { BETA_TOTAL_OPENAI_GENERATIONS_PER_MONTH, getFeatureCooldownSeconds, getFeatureUsagePolicy, type FeatureUsageKey } from "@/lib/billing/featurePolicy";
import type { ProductPlan } from "@/lib/billing/planLimits";
import { checkRateLimit } from "@/lib/rate-limit";

export type AiUsageGuardResult =
  | { allowed: true; reason: null; cooldownSeconds: number }
  | { allowed: false; reason: string; category: "local_only" | "not_configured" | "feature_limit" | "beta_limit" | "cooldown"; cooldownSeconds: number };

export async function canSpendOpenAiCredit({
  userId,
  projectId,
  feature,
  plan,
}: {
  userId: string;
  projectId: string;
  feature: FeatureUsageKey;
  plan: ProductPlan;
}): Promise<AiUsageGuardResult> {
  const policy = getFeatureUsagePolicy(feature);
  const cooldownSeconds = getFeatureCooldownSeconds(feature, plan);

  if (!policy.canUseOpenAI) {
    return { allowed: false, reason: "This feature is configured for local mode only.", category: "local_only", cooldownSeconds };
  }

  if (!process.env.OPENAI_API_KEY || process.env.DISABLE_OPENAI === "1") {
    return { allowed: true, reason: null, cooldownSeconds };
  }

  const monthlyLimit = policy.monthlyOpenAiLimit[plan];
  if (monthlyLimit <= 0) {
    return { allowed: false, reason: `OpenAI is not enabled for ${feature} on the ${plan} plan.`, category: "feature_limit", cooldownSeconds };
  }

  const cooldownOk = await checkRateLimit({ key: `ai_cooldown:${userId}:${projectId}:${feature}`, limit: 1, windowSeconds: cooldownSeconds });
  if (!cooldownOk) {
    return { allowed: false, reason: `Cooldown active for ${feature}. Try again in a few minutes.`, category: "cooldown", cooldownSeconds };
  }

  const featureMonthlyOk = await checkRateLimit({ key: `ai_monthly:${userId}:${feature}`, limit: monthlyLimit, windowSeconds: monthWindowSeconds() });
  if (!featureMonthlyOk) {
    return { allowed: false, reason: "You've reached the beta AI usage limit for this feature. Existing saved outputs are still available.", category: "feature_limit", cooldownSeconds };
  }

  const betaMonthlyOk = await checkRateLimit({ key: `ai_beta_total:${userId}`, limit: BETA_TOTAL_OPENAI_GENERATIONS_PER_MONTH, windowSeconds: monthWindowSeconds() });
  if (!betaMonthlyOk) {
    return { allowed: false, reason: "You've reached the beta AI usage limit. Existing saved outputs are still available.", category: "beta_limit", cooldownSeconds };
  }

  return { allowed: true, reason: null, cooldownSeconds };
}

function monthWindowSeconds() {
  return 30 * 24 * 60 * 60;
}
