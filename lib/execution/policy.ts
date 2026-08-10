import "server-only";
import { getPlanEntitlements, type ProductPlan } from "@/lib/billing/planLimits";

export type ExecutionClass = "FOUNDER_ACTION" | "AI_ASSISTED" | "AI_EXECUTABLE" | "AI_EXECUTABLE_WITH_APPROVAL";
export type ExecutionTier = "light" | "standard" | "heavy";
export type ExecutionStatus = "reserved" | "running" | "completed" | "failed" | "cancelled" | "released" | "blocked";
export type TerminationReason =
  | "COMPLETED" | "BUDGET_EXHAUSTED" | "CALL_LIMIT" | "TOOL_LIMIT" | "RETRY_LIMIT" | "STEP_LIMIT" | "TIMEOUT"
  | "USER_CANCELLED" | "APPROVAL_REQUIRED" | "PROVIDER_ERROR" | "INTERNAL_ERROR" | "POLICY_REJECTED";

export type ExecutionPolicy = {
  executionType: string;
  executionClass: ExecutionClass;
  tier: ExecutionTier;
  maxBudgetUsd: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxRetries: number;
  maxSteps: number;
  maxRuntimeMs: number;
  paidExternalToolsAllowed: boolean;
  sandboxAllowed: boolean;
  externalSideEffectsAllowed: boolean;
  approvalRequired: boolean;
  permittedModelTier: "fast" | "balanced" | "deep";
  permittedToolCategories: readonly string[];
};

const POLICIES: Record<string, ExecutionPolicy> = {
  market_research: {
    executionType: "market_research", executionClass: "AI_EXECUTABLE", tier: "standard",
    maxBudgetUsd: 0.25, maxModelCalls: 3, maxToolCalls: 1, maxRetries: 1, maxSteps: 4, maxRuntimeMs: 5 * 60_000,
    paidExternalToolsAllowed: true, sandboxAllowed: false, externalSideEffectsAllowed: false, approvalRequired: false,
    permittedModelTier: "balanced", permittedToolCategories: ["provider_web_research"],
  },
  "do-it-for-me.light": {
    executionType: "do-it-for-me.light", executionClass: "AI_EXECUTABLE", tier: "light",
    maxBudgetUsd: 0.05, maxModelCalls: 3, maxToolCalls: 0, maxRetries: 1, maxSteps: 5, maxRuntimeMs: 60_000,
    paidExternalToolsAllowed: false, sandboxAllowed: false, externalSideEffectsAllowed: false, approvalRequired: false,
    permittedModelTier: "fast", permittedToolCategories: [],
  },
  "do-it-for-me.standard": {
    executionType: "do-it-for-me.standard", executionClass: "AI_EXECUTABLE", tier: "standard",
    maxBudgetUsd: 0.25, maxModelCalls: 8, maxToolCalls: 4, maxRetries: 2, maxSteps: 12, maxRuntimeMs: 5 * 60_000,
    paidExternalToolsAllowed: false, sandboxAllowed: false, externalSideEffectsAllowed: false, approvalRequired: false,
    permittedModelTier: "balanced", permittedToolCategories: ["internal", "free_research"],
  },
  "do-it-for-me.heavy": {
    executionType: "do-it-for-me.heavy", executionClass: "AI_EXECUTABLE_WITH_APPROVAL", tier: "heavy",
    maxBudgetUsd: 1, maxModelCalls: 16, maxToolCalls: 8, maxRetries: 2, maxSteps: 20, maxRuntimeMs: 15 * 60_000,
    paidExternalToolsAllowed: false, sandboxAllowed: false, externalSideEffectsAllowed: false, approvalRequired: true,
    permittedModelTier: "deep", permittedToolCategories: ["internal", "free_research"],
  },
};

export const AUTONOMOUS_EXECUTION_ENABLED = () => process.env.AUTONOMOUS_EXECUTION_ENABLED === "true";
export const getExecutionPolicy = (executionType: string) => POLICIES[executionType] ?? null;

export type PolicyDecision = { allowed: true; policy: ExecutionPolicy; approvalRequired: boolean } | { allowed: false; reason: string };

export function evaluateExecutionPolicy({ plan, executionType }: { plan: ProductPlan; executionType: string }): PolicyDecision {
  if (!AUTONOMOUS_EXECUTION_ENABLED()) return { allowed: false, reason: "AUTONOMOUS_EXECUTION_DISABLED" };
  const policy = getExecutionPolicy(executionType);
  if (!policy) return { allowed: false, reason: "EXECUTION_TYPE_DENIED" };
  if (policy.executionClass !== "AI_EXECUTABLE" && policy.executionClass !== "AI_EXECUTABLE_WITH_APPROVAL") return { allowed: false, reason: "EXECUTION_CLASS_DENIED" };
  const entitlements = getPlanEntitlements(plan);
  if (!entitlements.allowedExecutionTiers.includes(policy.tier)) return { allowed: false, reason: "PLAN_TIER_DENIED" };
  if (policy.sandboxAllowed && !entitlements.sandboxAllowed) return { allowed: false, reason: "SANDBOX_DENIED" };
  return { allowed: true, policy, approvalRequired: policy.approvalRequired };
}

export function canContinueExecution({ policy, reservedBudgetUsd, actualCostUsd, modelCalls, toolCalls, retries, steps, startedAt, nextEstimatedCostUsd, now = Date.now() }: {
  policy: ExecutionPolicy; reservedBudgetUsd: number; actualCostUsd: number; modelCalls: number; toolCalls: number; retries: number; steps: number; startedAt: number; nextEstimatedCostUsd: number; now?: number;
}): { allowed: true; remainingBudgetUsd: number } | { allowed: false; reason: TerminationReason } {
  const hardBudget = Math.min(policy.maxBudgetUsd, reservedBudgetUsd);
  if (actualCostUsd + nextEstimatedCostUsd > hardBudget) return { allowed: false, reason: "BUDGET_EXHAUSTED" };
  if (modelCalls >= policy.maxModelCalls) return { allowed: false, reason: "CALL_LIMIT" };
  if (toolCalls >= policy.maxToolCalls) return { allowed: false, reason: "TOOL_LIMIT" };
  if (retries >= policy.maxRetries) return { allowed: false, reason: "RETRY_LIMIT" };
  if (steps >= policy.maxSteps) return { allowed: false, reason: "STEP_LIMIT" };
  if (now - startedAt >= policy.maxRuntimeMs) return { allowed: false, reason: "TIMEOUT" };
  return { allowed: true, remainingBudgetUsd: hardBudget - actualCostUsd };
}

export const listExecutionPolicies = () => Object.values(POLICIES);
