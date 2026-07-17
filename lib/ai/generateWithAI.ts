import "server-only";
import type { FeatureUsageKey } from "@/lib/billing/featurePolicy";
import { executeAiTask } from "@/lib/ai/platform/executeAiTask";
import { isAiTaskId } from "@/lib/ai/platform/registry";
import type { AiExecutionContext } from "@/lib/ai/platform/types";

export type GenerateJsonOptions<T> = {
  feature: FeatureUsageKey;
  system: string;
  user: string;
  fallback: T;
  validate?: (value: unknown) => T;
  logContext?: AiExecutionContext;
};

export async function generateJsonWithAI<T>({ feature, system, user, fallback, validate, logContext }: GenerateJsonOptions<T>): Promise<{ value: T; mode: "openai" | "mock"; fallbackReason?: string }> {
  if (!isAiTaskId(feature)) return { value: fallback, mode: "mock", fallbackReason: "This task is not registered for AI generation." };
  const result = await executeAiTask({ taskId: feature, system, user, fallback, validate, context: logContext });
  return { value: result.value, mode: result.mode === "cache" ? "mock" : result.mode, fallbackReason: result.fallbackReason };
}
