import "server-only";
import * as Sentry from "@sentry/nextjs";
import { calculateCostUsd } from "@/lib/ai/platform/pricing";
import { getAiTask, isPlanAllowed } from "@/lib/ai/platform/registry";
import { createAiRequestId, estimateTokens, hashPrivateValue, safeFailureReason } from "@/lib/ai/platform/privacy";
import { getAiProvider } from "@/lib/ai/platform/provider";
import { routeAiTask } from "@/lib/ai/platform/modelRouter";
import { finalizeAiRequest, recordAiOperationalEvent, reserveAiRequest, resolveAiActor } from "@/lib/ai/platform/repository";
import { prepareRegisteredPrompt } from "@/lib/ai/platform/promptRegistry";
import type { AiExecutionContext, AiExecutionResult, AiFailureCategory, AiTaskId } from "@/lib/ai/platform/types";

export async function executeAiTask<T>({
  taskId,
  system,
  user,
  fallback,
  validate,
  context = {},
}: {
  taskId: AiTaskId;
  system: string;
  user: string;
  fallback: T;
  validate?: (value: unknown) => T;
  context?: AiExecutionContext;
}): Promise<AiExecutionResult<T>> {
  const task = getAiTask(taskId);
  const registeredPrompt = prepareRegisteredPrompt(taskId, system, user);
  const requestId = createAiRequestId(context.requestId);
  const fallbackResult = (reason: string): AiExecutionResult<T> => ({
    value: fallback,
    mode: "mock",
    requestId,
    fallbackReason: reason,
  });

  if (process.env.AI_DISABLE_ALL === "1" || process.env.AI_DISABLE_OPENAI === "1" || process.env.DISABLE_OPENAI === "1") {
    return fallbackResult("AI generation is temporarily disabled.");
  }
  const actor = context.actor ?? (context.userId ? await resolveAiActor(context.userId) : null);
  if (!actor) return fallbackResult("AI generation requires an authenticated account.");
  if (!isPlanAllowed(actor.plan, task.minPlan)) return fallbackResult(`This AI feature requires the ${task.minPlan} plan.`);
  if (task.requiresProject && !context.projectId) return fallbackResult("A project is required for this AI task.");

  const route = routeAiTask(task);
  if (!route.ok) return fallbackResult(route.reason);
  if (!process.env.OPENAI_API_KEY) return fallbackResult("AI provider credentials are not configured.");

  const prompt = `${registeredPrompt.system}\n${registeredPrompt.user}`;
  const estimatedInputTokens = estimateTokens(prompt);
  if (estimatedInputTokens > task.maxInputTokens) return fallbackResult("The request context is too large for this AI task.");
  const estimatedCostUsd = calculateCostUsd({
    model: route.model,
    inputTokens: estimatedInputTokens,
    outputTokens: task.maxOutputTokens,
  });
  if (estimatedCostUsd === null || estimatedCostUsd > task.maxEstimatedCostUsd) {
    return fallbackResult("The request could not be safely priced.");
  }

  const inputHash = hashPrivateValue({
    taskId,
    promptVersion: task.promptVersion,
    schemaVersion: task.schemaVersion,
    system: registeredPrompt.system,
    user: registeredPrompt.user,
  });
  const idempotencyHash = hashPrivateValue({
    userId: actor.userId,
    projectId: context.projectId ?? "new-project",
    taskId,
    requestId,
  });
  const reservation = await Sentry.startSpan(
    {
      name: "ai.reserve",
      op: "ai.ledger",
      attributes: { "ai.task_id": taskId, "ai.route": route.route, "ai.model": route.model },
    },
    () => reserveAiRequest({
      actor,
      task,
      projectId: context.projectId ?? null,
      requestId,
      idempotencyHash,
      inputHash,
      route: route.route,
      model: route.model,
      estimatedInputTokens,
      estimatedCostUsd,
      cacheBypass: context.cacheBypass === true,
      source: context.source ?? "server_action",
      synthetic: context.synthetic === true,
    }),
  );
  if (reservation.decision === "cached") {
    await recordAiOperationalEvent({ userId: actor.userId, eventName: "ai_request_cached", metadata: { request_id: requestId, task_id: taskId, route: route.route } });
    try {
      return { value: validate ? validate(reservation.value) : reservation.value as T, mode: "cache", requestId };
    } catch {
      return fallbackResult("The cached AI result could not be validated.");
    }
  }
  if (reservation.decision === "duplicate") {
    await recordAiOperationalEvent({ userId: actor.userId, eventName: "ai_request_duplicate_prevented", metadata: { request_id: requestId, task_id: taskId, status: reservation.status } });
    if (reservation.status === "completed" && reservation.value !== null) {
      try {
        return { value: validate ? validate(reservation.value) : reservation.value as T, mode: "cache", requestId };
      } catch {
        return fallbackResult("The previous AI result could not be validated.");
      }
    }
    return fallbackResult("An identical AI request is already in progress.");
  }
  if (reservation.decision === "blocked") {
    await recordAiOperationalEvent({ userId: actor.userId, eventName: "ai_request_blocked", metadata: { request_id: requestId, task_id: taskId, category: reservation.category } });
    return fallbackResult(reservation.reason);
  }

  const startedAt = Date.now();
  await recordAiOperationalEvent({ userId: actor.userId, eventName: "ai_request_started", metadata: { request_id: requestId, task_id: taskId, route: route.route, model: route.model } });
  try {
    const provider = getAiProvider(route.provider);
    const providerResult = await Sentry.startSpan(
      {
        name: "ai.provider.request",
        op: "ai.provider",
        attributes: { "ai.task_id": taskId, "ai.route": route.route, "ai.model": route.model },
      },
      () => provider.execute({
        model: route.model,
        system: registeredPrompt.system,
        user: registeredPrompt.user,
        maxOutputTokens: task.maxOutputTokens,
        timeoutMs: task.timeoutMs,
        requestId,
      }),
    );
    let value: T;
    try {
      value = validate ? validate(providerResult.value) : providerResult.value as T;
    } catch (error) {
      const cost = calculateCostUsd({ model: route.model, ...providerResult.usage });
      await finalizeAiRequest({
        ledgerId: reservation.ledgerId,
        status: "failed",
        usage: providerResult.usage,
        actualCostUsd: cost,
        providerRequestId: providerResult.providerRequestId,
        attempts: providerResult.attempts,
        latencyMs: providerResult.latencyMs,
        failureCategory: "invalid_output",
      });
      return fallbackResult(safeFailureReason(error));
    }
    const actualCostUsd = calculateCostUsd({ model: route.model, ...providerResult.usage });
    const persisted = await finalizeAiRequest({
      ledgerId: reservation.ledgerId,
      status: "completed",
      usage: providerResult.usage,
      actualCostUsd,
      result: value,
      providerRequestId: providerResult.providerRequestId,
      attempts: providerResult.attempts,
      latencyMs: providerResult.latencyMs,
    });
    if (!persisted) return fallbackResult("The AI result could not be safely recorded.");
    return { value, mode: "openai", requestId, usage: providerResult.usage };
  } catch (error) {
    const category = getFailureCategory(error);
    await finalizeAiRequest({
      ledgerId: reservation.ledgerId,
      status: category === "provider_timeout" ? "reconciliation_needed" : "failed",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      actualCostUsd: null,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      failureCategory: category,
      retryable: category === "provider_rate_limit" || category === "provider_unavailable",
    });
    return fallbackResult(safeFailureReason(error));
  }
}

function getFailureCategory(error: unknown): AiFailureCategory {
  const category = error && typeof error === "object" && "category" in error
    ? String((error as { category?: unknown }).category)
    : "unknown";
  const allowed: AiFailureCategory[] = [
    "provider_auth",
    "provider_rate_limit",
    "provider_timeout",
    "provider_unavailable",
    "invalid_output",
  ];
  return allowed.includes(category as AiFailureCategory) ? category as AiFailureCategory : "unknown";
}
