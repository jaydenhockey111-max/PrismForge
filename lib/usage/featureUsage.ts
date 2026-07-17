import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeatureUsageKey } from "@/lib/billing/featurePolicy";
import type { Json } from "@/lib/database.types";

export type FeatureUsageSource = "openai" | "fallback" | "cache" | "blocked";

export async function logFeatureUsage({
  userId,
  projectId,
  feature,
  source,
  model,
  maxOutputTokens,
  promptSize,
  durationMs,
  reason,
  success,
  errorCategory,
}: {
  userId?: string | null;
  projectId?: string | null;
  feature: FeatureUsageKey;
  source: FeatureUsageSource;
  model?: string | null;
  maxOutputTokens?: number | null;
  promptSize?: number | null;
  durationMs?: number | null;
  reason?: string | null;
  success?: boolean;
  errorCategory?: string | null;
}) {
  const didSucceed = success ?? source !== "blocked";
  const metadata = {
    feature,
    project_id: projectId ?? null,
    source,
    model: model ?? null,
    max_output_tokens: maxOutputTokens ?? null,
    approx_prompt_size: promptSize ?? null,
    duration_ms: durationMs ?? null,
    reason: reason ?? null,
    success: didSucceed,
    error_category: errorCategory ?? null,
  } satisfies Record<string, Json | undefined>;

  console.info("[feature-usage]", {
    feature,
    userId: userId ?? null,
    projectId: projectId ?? null,
    source,
    model: model ?? null,
    maxOutputTokens: maxOutputTokens ?? null,
    approxPromptSize: promptSize ?? null,
    durationMs: durationMs ?? null,
    success: didSucceed,
    errorCategory: errorCategory ?? null,
  });

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[feature-usage] admin client unavailable", error);
    return;
  }

  try {
    await admin.from("feature_usage_events").insert({
      user_id: userId ?? null,
      project_id: projectId ?? null,
      feature,
      source,
      model: model ?? null,
      max_output_tokens: maxOutputTokens ?? null,
      approx_prompt_size: promptSize ?? null,
      duration_ms: durationMs ?? null,
      reason: reason ?? null,
      success: didSucceed,
      error_category: errorCategory ?? null,
      metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[feature-usage] feature_usage_events insert failed", error);
  }

  try {
    await admin.from("app_events").insert({
      user_id: userId ?? null,
      event_name: "ai_feature_used",
      metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[feature-usage] app_events insert failed", error);
  }
}
