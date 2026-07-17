import "server-only";
import { decideAiFeature, type AiFeatureKey } from "@/lib/ai/aiFeaturePolicy";
import { getFeatureUsagePolicy } from "@/lib/billing/featurePolicy";
import { extractResponseText, getOpenAIConfig, type OpenAIResponse } from "@/lib/ai/openaiClient";
import { logFeatureUsage } from "@/lib/usage/featureUsage";

export type GenerateJsonOptions<T> = {
  feature: AiFeatureKey;
  system: string;
  user: string;
  fallback: T;
  validate?: (value: unknown) => T;
  logContext?: { userId?: string | null; projectId?: string | null };
};

export async function generateJsonWithAI<T>({ feature, system, user, fallback, validate, logContext }: GenerateJsonOptions<T>): Promise<{ value: T; mode: "openai" | "mock"; fallbackReason?: string }> {
  const startedAt = Date.now();
  const decision = decideAiFeature(feature);
  const policy = getFeatureUsagePolicy(feature);
  const config = getOpenAIConfig(policy.maxOutputTokens);
  const promptSize = system.length + user.length;
  if (decision.mode !== "api" || !config) {
    await logFeatureUsage({ ...logContext, feature, source: "fallback", model: config?.model ?? null, maxOutputTokens: config?.maxOutputTokens ?? policy.maxOutputTokens, promptSize, durationMs: Date.now() - startedAt, reason: decision.reason, success: true });
    return { value: fallback, mode: "mock", fallbackReason: decision.reason };
  }

  const timeoutMs = getOpenAITimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: { format: { type: "json_object" } },
        max_output_tokens: config.maxOutputTokens,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
    const payload = (await response.json()) as OpenAIResponse;
    const text = extractResponseText(payload);
    if (!text) throw new Error("OpenAI response did not contain text output.");
    if (text.length > 60_000) throw new Error("OpenAI response was too large.");
    const parsed = parsePossiblyWrappedJson(text);
    await logFeatureUsage({ ...logContext, feature, source: "openai", model: config.model, maxOutputTokens: config.maxOutputTokens, promptSize, durationMs: Date.now() - startedAt, success: true });
    return { value: validate ? validate(parsed) : parsed as T, mode: "openai" };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(`[ai:${feature}] falling back`, error);
    const reason = error instanceof Error ? error.message : "AI provider failed";
    await logFeatureUsage({ ...logContext, feature, source: "fallback", model: config.model, maxOutputTokens: config.maxOutputTokens, promptSize, durationMs: Date.now() - startedAt, reason, success: false, errorCategory: "openai_error" });
    return { value: fallback, mode: "mock", fallbackReason: reason };
  } finally {
    clearTimeout(timeout);
  }
}

function parsePossiblyWrappedJson(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    throw new Error("OpenAI response was not valid JSON.");
  }
}

function getOpenAITimeoutMs() {
  const raw = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? 18_000);
  return Number.isFinite(raw) ? Math.min(Math.max(raw, 5_000), 45_000) : 18_000;
}
