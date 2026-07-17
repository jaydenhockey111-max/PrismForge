import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectivePlan } from "@/lib/billing/planLimits";
import type { AiActor, AiFailureCategory, AiReservation, AiTaskDefinition, AiUsage } from "@/lib/ai/platform/types";
import { GLOBAL_AI_LIMITS } from "@/lib/ai/platform/registry";

type RpcResponse = { data: unknown; error: { message: string } | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResponse>;
};

type ReservationPayload = {
  decision?: string;
  ledger_id?: string | null;
  reason?: string;
  category?: AiFailureCategory;
  status?: string;
  result?: unknown;
};

export async function resolveAiActor(userId: string): Promise<AiActor | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,plan,beta_access_until,lifetime_founder,beta_feedback_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { userId: data.id, plan: getEffectivePlan(data) };
}

export async function reserveAiRequest({
  actor,
  task,
  projectId,
  requestId,
  idempotencyHash,
  inputHash,
  route,
  model,
  estimatedInputTokens,
  estimatedCostUsd,
  cacheBypass,
  source,
  synthetic,
}: {
  actor: AiActor;
  task: AiTaskDefinition;
  projectId: string | null;
  requestId: string;
  idempotencyHash: string;
  inputHash: string;
  route: string;
  model: string;
  estimatedInputTokens: number;
  estimatedCostUsd: number;
  cacheBypass: boolean;
  source: string;
  synthetic: boolean;
}): Promise<AiReservation> {
  const client = createAdminClient() as unknown as RpcClient;
  const { data, error } = await client.rpc("reserve_ai_request", {
    p_request: {
      user_id: actor.userId,
      project_id: projectId,
      task_id: task.id,
      request_id: requestId,
      idempotency_key_hash: idempotencyHash,
      input_hash: inputHash,
      provider: "openai",
      model_route: route,
      model_id: model,
      prompt_version: task.promptVersion,
      schema_version: task.schemaVersion,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: task.maxOutputTokens,
      reserved_cost_usd: estimatedCostUsd,
      cache_ttl_seconds: task.cacheTtlSeconds,
      cache_bypass: cacheBypass,
      requires_project: task.requiresProject,
      minimum_plan: task.minPlan,
      user_plan: actor.plan,
      task_daily_limit: task.dailyLimit[actor.plan],
      task_monthly_limit: task.monthlyLimit[actor.plan],
      user_daily_limit: GLOBAL_AI_LIMITS.dailyRequestsByPlan[actor.plan],
      user_monthly_limit: GLOBAL_AI_LIMITS.monthlyRequests,
      global_soft_daily_usd: GLOBAL_AI_LIMITS.softDailyUsd,
      global_hard_daily_usd: GLOBAL_AI_LIMITS.hardDailyUsd,
      global_soft_monthly_usd: GLOBAL_AI_LIMITS.softMonthlyUsd,
      global_hard_monthly_usd: GLOBAL_AI_LIMITS.hardMonthlyUsd,
      task_burst_limit: task.burstLimitPerMinute,
      task_sustained_limit: task.sustainedLimitPerTenMinutes,
      global_requests_per_minute: GLOBAL_AI_LIMITS.requestsPerMinute,
      source,
      synthetic,
    },
  });
  if (error) {
    return {
      decision: "blocked",
      ledgerId: null,
      reason: "AI safety accounting is temporarily unavailable.",
      category: "repository_unavailable",
    };
  }
  const payload = (data ?? {}) as ReservationPayload;
  const ledgerId = payload.ledger_id ?? null;
  if (payload.decision === "reserved" && ledgerId) return { decision: "reserved", ledgerId };
  if (payload.decision === "cached" && ledgerId) return { decision: "cached", ledgerId, value: payload.result };
  if (payload.decision === "duplicate" && ledgerId) {
    return { decision: "duplicate", ledgerId, status: payload.status ?? "reserved", value: payload.result ?? null };
  }
  return {
    decision: "blocked",
    ledgerId,
    reason: payload.reason ?? "AI generation is temporarily unavailable.",
    category: payload.category ?? "limit",
  };
}

export async function finalizeAiRequest({
  ledgerId,
  status,
  usage,
  actualCostUsd,
  result,
  providerRequestId,
  attempts,
  latencyMs,
  failureCategory,
  retryable,
}: {
  ledgerId: string;
  status: "completed" | "failed" | "reconciliation_needed";
  usage: AiUsage;
  actualCostUsd: number | null;
  result?: unknown;
  providerRequestId?: string | null;
  attempts: number;
  latencyMs: number;
  failureCategory?: string | null;
  retryable?: boolean;
}) {
  const client = createAdminClient() as unknown as RpcClient;
  const { data, error } = await client.rpc("finalize_ai_request", {
    p_request: {
      ledger_id: ledgerId,
      status,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      actual_cost_usd: actualCostUsd,
      result: result ?? null,
      provider_request_id: providerRequestId ?? null,
      attempt_count: attempts,
      latency_ms: latencyMs,
      failure_category: failureCategory ?? null,
      retryable: retryable ?? false,
    },
  });
  return !error && Boolean(data && typeof data === "object" && "ok" in data && (data as { ok?: unknown }).ok === true);
}

export async function recordAiOperationalEvent({
  userId,
  eventName,
  metadata,
}: {
  userId: string;
  eventName: "ai_request_started" | "ai_request_cached" | "ai_request_blocked" | "ai_request_duplicate_prevented";
  metadata: Record<string, string | number | boolean | null>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("app_events").insert({
      user_id: userId,
      event_name: eventName,
      metadata,
    });
  } catch {
    // Observability must never bypass or break the financial control path.
  }
}
