import "server-only";
import type { Profile } from "@/lib/database.types";

export type ProductPlan = "free" | "pro" | "founder";

export type PlanLimits = {
  /** Server-authoritative product entitlements. Keep pricing UI derived from this registry. */
  activeProjects: number;
  reportsPerMonth: number | "unlimited";
  savedProjects: number | "unlimited";
  aiEmployeeActionsPerDay: number;
  marketPulseRefreshesPerDay: number;
  notesPerProject: number;
  savedMarketPulseRunsPerProject: number;
  generatedOutputsPerProject: number;
  outputHistoryPerProject: number;
  crossProjectLearning: boolean;
  founderIntelligence: boolean;
  modelTier: "fast" | "balanced" | "deep";
  monthlyExecutionAllowanceUsd: number;
  allowedExecutionTiers: readonly ("light" | "standard" | "heavy")[];
  sandboxAllowed: boolean;
};

export const PLAN_LIMITS: Record<ProductPlan, PlanLimits> = {
  free: {
    activeProjects: 1,
    reportsPerMonth: 3,
    savedProjects: 1,
    aiEmployeeActionsPerDay: 5,
    marketPulseRefreshesPerDay: 2,
    notesPerProject: 1,
    savedMarketPulseRunsPerProject: 1,
    generatedOutputsPerProject: 6,
    outputHistoryPerProject: 1,
    crossProjectLearning: false,
    founderIntelligence: false,
    modelTier: "fast",
    monthlyExecutionAllowanceUsd: 0,
    allowedExecutionTiers: [],
    sandboxAllowed: false,
  },
  pro: {
    activeProjects: 10,
    reportsPerMonth: 30,
    savedProjects: 10,
    aiEmployeeActionsPerDay: 40,
    marketPulseRefreshesPerDay: 10,
    notesPerProject: 10,
    savedMarketPulseRunsPerProject: 10,
    generatedOutputsPerProject: 10,
    outputHistoryPerProject: 3,
    crossProjectLearning: true,
    founderIntelligence: false,
    modelTier: "balanced",
    monthlyExecutionAllowanceUsd: 1,
    allowedExecutionTiers: ["light", "standard"],
    sandboxAllowed: false,
  },
  founder: {
    activeProjects: 50,
    reportsPerMonth: 50,
    savedProjects: 50,
    aiEmployeeActionsPerDay: 120,
    marketPulseRefreshesPerDay: 30,
    notesPerProject: 25,
    savedMarketPulseRunsPerProject: 25,
    generatedOutputsPerProject: 10,
    outputHistoryPerProject: 5,
    crossProjectLearning: true,
    founderIntelligence: true,
    modelTier: "deep",
    monthlyExecutionAllowanceUsd: 5,
    allowedExecutionTiers: ["light", "standard", "heavy"],
    sandboxAllowed: false,
  },
};

export type PlanProfile = Pick<Profile, "email" | "plan"> & Partial<Pick<Profile, "beta_access_until" | "lifetime_founder" | "beta_feedback_completed">>;

export function getEffectivePlan(profile: PlanProfile): ProductPlan {
  if (profile.lifetime_founder || profile.beta_feedback_completed) return "founder";
  if (isTemporaryBetaFounder(profile)) return "founder";
  if (process.env.PRIVATE_BETA_FOUNDER_ACCESS === "1") return "founder";
  if (profile.plan === "founder") return "founder";
  return profile.plan === "premium" ? "pro" : "free";
}

export function getPlanLimits(profile: PlanProfile) {
  return PLAN_LIMITS[getEffectivePlan(profile)];
}

export function getPlanEntitlements(plan: ProductPlan) {
  return PLAN_LIMITS[plan];
}

export function canUsePlanFeature(plan: ProductPlan, feature: "crossProjectLearning" | "founderIntelligence" | "sandboxAllowed") {
  return PLAN_LIMITS[plan][feature];
}

export function isTemporaryBetaFounder(profile: Partial<Pick<Profile, "beta_access_until">>) {
  return Boolean(profile.beta_access_until && new Date(profile.beta_access_until).getTime() > Date.now());
}

export function isUnlimited(value: number | "unlimited"): value is "unlimited" {
  return value === "unlimited";
}
