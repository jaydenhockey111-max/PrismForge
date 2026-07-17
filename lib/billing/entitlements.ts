import type { Profile, UserXp } from "@/lib/database.types";
import { getEffectivePlan, isTemporaryBetaFounder } from "@/lib/billing/planLimits";

export type Entitlements = {
  hasPremiumAccess: boolean;
  reason: "paid" | "trial" | "free" | "beta_founder" | "lifetime_founder";
  premiumTrialUntil: string | null;
  effectivePlan: "free" | "pro" | "founder";
};

export function getEntitlements(profile: Profile, xp?: Pick<UserXp, "premium_trial_until"> | null): Entitlements {
  const premiumTrialUntil = xp?.premium_trial_until ?? null;
  const trialActive = premiumTrialUntil ? new Date(premiumTrialUntil).getTime() > Date.now() : false;
  const effectivePlan = getEffectivePlan(profile);
  if (profile.lifetime_founder || profile.beta_feedback_completed) return { hasPremiumAccess: true, reason: "lifetime_founder", premiumTrialUntil, effectivePlan };
  if (isTemporaryBetaFounder(profile)) return { hasPremiumAccess: true, reason: "beta_founder", premiumTrialUntil, effectivePlan };
  if (process.env.PRIVATE_BETA_FOUNDER_ACCESS === "1" && effectivePlan === "founder" && profile.plan !== "premium" && !trialActive) return { hasPremiumAccess: true, reason: "beta_founder", premiumTrialUntil, effectivePlan };
  if (profile.plan === "premium") return { hasPremiumAccess: true, reason: "paid", premiumTrialUntil, effectivePlan };
  if (trialActive) return { hasPremiumAccess: true, reason: "trial", premiumTrialUntil, effectivePlan };
  return { hasPremiumAccess: false, reason: "free", premiumTrialUntil, effectivePlan };
}
