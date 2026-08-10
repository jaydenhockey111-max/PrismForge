import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePlan, getPlanEntitlements } from "@/lib/billing/planLimits";
import { AUTONOMOUS_EXECUTION_ENABLED, evaluateExecutionPolicy, type ExecutionStatus, type TerminationReason } from "@/lib/execution/policy";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export async function preflightExecution({ userId, projectId, executionType, estimatedCostUsd, requestId }: { userId: string; projectId: string | null; executionType: string; estimatedCostUsd: number; requestId: string }) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id,email,plan,beta_access_until,lifetime_founder,beta_feedback_completed").eq("id", userId).maybeSingle();
  if (!profile) return { allowed: false as const, reason: "AUTHORIZATION" };
  const decision = evaluateExecutionPolicy({ plan: getEffectivePlan(profile), executionType });
  if (!decision.allowed) return decision;
  if (estimatedCostUsd <= 0 || estimatedCostUsd > decision.policy.maxBudgetUsd) return { allowed: false as const, reason: "JOB_BUDGET_EXCEEDED" };
  const client = admin as unknown as RpcClient;
  const plan = getEffectivePlan(profile);
  const { data, error } = await client.rpc("reserve_execution_budget", {
    p_request: {
      user_id: userId,
      project_id: projectId,
      execution_type: executionType,
      request_id: requestId,
      estimated_cost_usd: estimatedCostUsd,
      monthly_allowance_usd: getPlanEntitlements(plan).monthlyExecutionAllowanceUsd,
      policy_max_budget_usd: decision.policy.maxBudgetUsd,
      approval_required: decision.approvalRequired,
    },
  });
  if (error || !data || typeof data !== "object") return { allowed: false as const, reason: "ACCOUNTING_UNAVAILABLE" };
  const result = data as Record<string, unknown>;
  return result.decision === "reserved"
    ? { allowed: true as const, policy: decision.policy, reservationId: String(result.reservation_id), reservedBudgetUsd: Number(result.reserved_budget_usd), remainingMonthlyAllowanceUsd: Number(result.remaining_monthly_allowance_usd), approvalRequired: decision.approvalRequired }
    : { allowed: false as const, reason: String(result.reason ?? "POLICY_REJECTED") };
}

export async function recordExecutionUsage({ reservationId, internalActualCostUsd, customerAllowanceConsumedUsd, modelCalls, toolCalls, retries, steps }: { reservationId: string; internalActualCostUsd: number; customerAllowanceConsumedUsd: number; modelCalls: number; toolCalls: number; retries: number; steps: number }) {
  return invoke("record_execution_usage", { p_request: { reservation_id: reservationId, internal_actual_cost_usd: internalActualCostUsd, customer_allowance_consumed_usd: customerAllowanceConsumedUsd, model_calls: modelCalls, tool_calls: toolCalls, retries, steps } });
}

/** Must be called immediately before work begins; it rechecks the global kill switch. */
export async function startExecution(reservationId: string) {
  if (!AUTONOMOUS_EXECUTION_ENABLED()) return false;
  return invoke("start_execution_budget", { p_request: { reservation_id: reservationId } });
}

export async function finalizeExecution({ reservationId, status, terminationReason }: { reservationId: string; status: Exclude<ExecutionStatus, "reserved" | "running">; terminationReason: TerminationReason }) {
  return invoke("finalize_execution_budget", { p_request: { reservation_id: reservationId, status, termination_reason: terminationReason } });
}

async function invoke(name: string, args: Record<string, unknown>) {
  const client = createAdminClient() as unknown as RpcClient;
  const { data, error } = await client.rpc(name, args);
  return !error && Boolean(data && typeof data === "object" && (data as Record<string, unknown>).ok === true);
}
