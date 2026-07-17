import "server-only";
import type { ProductPlan } from "@/lib/billing/planLimits";

export type FeatureUsageKey =
  | "opportunity_report"
  | "ceo_ai"
  | "marketer_ai"
  | "designer_ai"
  | "engineer_ai"
  | "validation_survey"
  | "competitive_battlecard"
  | "pricing_tiers"
  | "video_scripts"
  | "sprint_tasks"
  | "market_pulse_refresh"
  | "founder_brief";

export type FeatureUsagePolicy = {
  feature: FeatureUsageKey;
  minPlan: ProductPlan;
  canUseOpenAI: boolean;
  canUseExternalSearch: boolean;
  cooldownSeconds: number;
  cooldownSecondsByPlan: Record<ProductPlan, number>;
  maxOutputTokens: number;
  monthlyOpenAiLimit: Record<ProductPlan, number>;
  shouldCache: boolean;
  requiresRegenerationConfirmation: boolean;
};

export const BETA_TOTAL_OPENAI_GENERATIONS_PER_MONTH = Number(process.env.BETA_TOTAL_OPENAI_GENERATIONS_PER_MONTH ?? 50);

export const FEATURE_USAGE_POLICIES: Record<FeatureUsageKey, FeatureUsagePolicy> = {
  opportunity_report: policy("opportunity_report", "free", true, false, { free: 60, pro: 60, founder: 60 }, 1_000, { free: 3, pro: 30, founder: 50 }),
  ceo_ai: policy("ceo_ai", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 600, { free: 0, pro: 25, founder: 50 }),
  marketer_ai: policy("marketer_ai", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 750, { free: 0, pro: 25, founder: 50 }),
  designer_ai: policy("designer_ai", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 600, { free: 0, pro: 25, founder: 50 }),
  engineer_ai: policy("engineer_ai", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 650, { free: 0, pro: 25, founder: 50 }),
  validation_survey: policy("validation_survey", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 800, { free: 0, pro: 25, founder: 50 }),
  competitive_battlecard: policy("competitive_battlecard", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 800, { free: 0, pro: 25, founder: 50 }),
  pricing_tiers: policy("pricing_tiers", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 650, { free: 0, pro: 25, founder: 50 }),
  video_scripts: policy("video_scripts", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 800, { free: 0, pro: 25, founder: 50 }),
  sprint_tasks: policy("sprint_tasks", "pro", true, false, { free: 300, pro: 300, founder: 300 }, 650, { free: 0, pro: 25, founder: 50 }),
  market_pulse_refresh: policy("market_pulse_refresh", "pro", false, false, { free: 1_800, pro: 1_800, founder: 1_800 }, 0, { free: 0, pro: 0, founder: 0 }),
  founder_brief: policy("founder_brief", "founder", false, false, { free: 300, pro: 300, founder: 300 }, 700, { free: 0, pro: 0, founder: 0 }),
};

const PLAN_RANK: Record<ProductPlan, number> = { free: 0, pro: 1, founder: 2 };

export function getFeatureUsagePolicy(feature: FeatureUsageKey) {
  return FEATURE_USAGE_POLICIES[feature];
}

export function getFeatureCooldownSeconds(feature: FeatureUsageKey, plan: ProductPlan) {
  const policy = getFeatureUsagePolicy(feature);
  return policy.cooldownSecondsByPlan[plan] ?? policy.cooldownSeconds;
}

export function planCanAccessFeature(plan: ProductPlan, feature: FeatureUsageKey) {
  return PLAN_RANK[plan] >= PLAN_RANK[getFeatureUsagePolicy(feature).minPlan];
}

function policy(
  feature: FeatureUsageKey,
  minPlan: ProductPlan,
  canUseOpenAI: boolean,
  canUseExternalSearch: boolean,
  cooldownSecondsByPlan: Record<ProductPlan, number>,
  maxOutputTokens: number,
  monthlyOpenAiLimit: Record<ProductPlan, number>,
): FeatureUsagePolicy {
  return {
    feature,
    minPlan,
    canUseOpenAI,
    canUseExternalSearch,
    cooldownSeconds: cooldownSecondsByPlan.founder,
    cooldownSecondsByPlan,
    maxOutputTokens,
    monthlyOpenAiLimit,
    shouldCache: true,
    requiresRegenerationConfirmation: true,
  };
}
