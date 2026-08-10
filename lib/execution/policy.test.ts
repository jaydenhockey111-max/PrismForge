import { afterEach, describe, expect, it, vi } from "vitest";
import { canContinueExecution, evaluateExecutionPolicy, getExecutionPolicy } from "@/lib/execution/policy";

describe("autonomous execution policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps founder actions and disabled autonomous execution out of the execution path", () => {
    vi.stubEnv("AUTONOMOUS_EXECUTION_ENABLED", "false");
    expect(evaluateExecutionPolicy({ plan: "founder", executionType: "do-it-for-me.light" })).toEqual({ allowed: false, reason: "AUTONOMOUS_EXECUTION_DISABLED" });
    vi.stubEnv("AUTONOMOUS_EXECUTION_ENABLED", "true");
    expect(evaluateExecutionPolicy({ plan: "founder", executionType: "founder-action" })).toEqual({ allowed: false, reason: "EXECUTION_TYPE_DENIED" });
  });

  it("uses server-controlled tier and approval rules instead of caller-provided budgets", () => {
    vi.stubEnv("AUTONOMOUS_EXECUTION_ENABLED", "true");
    expect(evaluateExecutionPolicy({ plan: "free", executionType: "do-it-for-me.light" })).toEqual({ allowed: false, reason: "PLAN_TIER_DENIED" });
    expect(evaluateExecutionPolicy({ plan: "founder", executionType: "do-it-for-me.heavy" })).toMatchObject({ allowed: true, approvalRequired: true });
  });

  it("terminates on the first exhausted hard limit even with budget remaining", () => {
    const policy = getExecutionPolicy("do-it-for-me.light");
    if (!policy) throw new Error("expected light policy");
    expect(canContinueExecution({ policy, reservedBudgetUsd: 0.05, actualCostUsd: 0.001, modelCalls: policy.maxModelCalls, toolCalls: 0, retries: 0, steps: 0, startedAt: Date.now(), nextEstimatedCostUsd: 0.001 })).toEqual({ allowed: false, reason: "CALL_LIMIT" });
    expect(canContinueExecution({ policy, reservedBudgetUsd: 0.05, actualCostUsd: 0.049, modelCalls: 0, toolCalls: 0, retries: 0, steps: 0, startedAt: Date.now(), nextEstimatedCostUsd: 0.002 })).toEqual({ allowed: false, reason: "BUDGET_EXHAUSTED" });
  });

  it("does not reset the original job budget for retries", () => {
    const policy = getExecutionPolicy("do-it-for-me.standard");
    if (!policy) throw new Error("expected standard policy");
    expect(canContinueExecution({ policy, reservedBudgetUsd: 0.25, actualCostUsd: 0.23, modelCalls: 1, toolCalls: 0, retries: 1, steps: 1, startedAt: Date.now(), nextEstimatedCostUsd: 0.03 })).toEqual({ allowed: false, reason: "BUDGET_EXHAUSTED" });
    expect(canContinueExecution({ policy, reservedBudgetUsd: 0.25, actualCostUsd: 0.01, modelCalls: 1, toolCalls: 0, retries: policy.maxRetries, steps: 1, startedAt: Date.now(), nextEstimatedCostUsd: 0.01 })).toEqual({ allowed: false, reason: "RETRY_LIMIT" });
  });
});
