import "server-only";
import type { Profile } from "@/lib/database.types";
import { getEffectivePlan, type ProductPlan } from "@/lib/billing/planLimits";

export type FeatureKey =
  | "opportunity_report"
  | "ai_employees"
  | "market_pulse"
  | "launch_command_center"
  | "project_export"
  | "founder_notes"
  | "weekly_founder_digest";

const FEATURE_MIN_PLAN: Record<FeatureKey, ProductPlan> = {
  opportunity_report: "free",
  ai_employees: "pro",
  market_pulse: "pro",
  launch_command_center: "pro",
  project_export: "pro",
  founder_notes: "pro",
  weekly_founder_digest: "pro",
};

const PLAN_RANK: Record<ProductPlan, number> = { free: 0, pro: 1, founder: 2 };

export function getFeatureAccess(profile: Pick<Profile, "email" | "plan">, feature: FeatureKey) {
  const currentPlan = getEffectivePlan(profile);
  const requiredPlan = FEATURE_MIN_PLAN[feature];
  return {
    allowed: PLAN_RANK[currentPlan] >= PLAN_RANK[requiredPlan],
    currentPlan,
    requiredPlan,
    feature,
    message: `This feature is available on ${requiredPlan}. Upgrade to unlock deeper AI strategy, market intelligence, and launch tools to improve your business.`,
  };
}

export const canAccessFeature = getFeatureAccess;
