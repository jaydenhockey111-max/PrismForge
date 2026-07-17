import "server-only";
import type { AiProviderResult } from "@/lib/ai/platform/types";

type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
};

export async function requestOpenAiJson({
  model,
  system,
  user,
  maxOutputTokens,
  timeoutMs,
  requestId,
}: {
  model: string;
  system: string;
  user: string;
  maxOutputTokens: number;
  timeoutMs: number;
  requestId: string;
}): Promise<AiProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw taggedError("provider_auth", "AI provider credentials are not configured.");

  const startedAt = Date.now();
  let attempts = 0;
  let lastError: unknown;
  while (attempts < 3) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Client-Request-Id": requestId,
        },
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          text: { format: { type: "json_object" } },
          max_output_tokens: maxOutputTokens,
        }),
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempts < 3) {
          await retryDelay(attempts);
          continue;
        }
        throw taggedError(
          response.status === 429 ? "provider_rate_limit" : response.status >= 500 ? "provider_unavailable" : "provider_auth",
          `AI provider request failed with status ${response.status}.`,
        );
      }
      const payload = (await response.json()) as OpenAIResponse;
      const text = extractResponseText(payload);
      if (!text || text.length > 60_000) throw taggedError("invalid_output", "AI response text was missing or too large.");
      return {
        value: parsePossiblyWrappedJson(text),
        usage: {
          inputTokens: payload.usage?.input_tokens ?? 0,
          outputTokens: payload.usage?.output_tokens ?? 0,
          cachedInputTokens: payload.usage?.input_tokens_details?.cached_tokens ?? 0,
        },
        providerRequestId: payload.id ?? response.headers.get("x-request-id"),
        latencyMs: Date.now() - startedAt,
        attempts,
      };
    } catch (error) {
      lastError = error;
      const transient = error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("fetch"));
      if (transient && attempts < 3) {
        await retryDelay(attempts);
        continue;
      }
      if (error instanceof Error && error.name === "AbortError") throw taggedError("provider_timeout", "AI provider request timed out.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? taggedError("provider_unavailable", "AI provider was unavailable.");
}

function extractResponseText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text;
  return payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n");
}

function parsePossiblyWrappedJson(text: string) {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    throw taggedError("invalid_output", "AI response was not valid JSON.");
  }
}

function taggedError(category: string, message: string) {
  const error = new Error(message) as Error & { category?: string };
  error.category = category;
  return error;
}

async function retryDelay(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 150 * (2 ** (attempt - 1))));
}
