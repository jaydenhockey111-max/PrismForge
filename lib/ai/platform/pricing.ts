import "server-only";
import type { AiRouteId } from "@/lib/ai/platform/types";

type Price = {
  inputPerMillionUsd: number;
  cachedInputPerMillionUsd: number;
  outputPerMillionUsd: number;
  effectiveDate: string;
};

const PRICES: Record<string, Price> = {
  "gpt-4.1-mini": {
    inputPerMillionUsd: 0.4,
    cachedInputPerMillionUsd: 0.1,
    outputPerMillionUsd: 1.6,
    effectiveDate: "2025-04-14",
  },
  "gpt-4.1-mini-2025-04-14": {
    inputPerMillionUsd: 0.4,
    cachedInputPerMillionUsd: 0.1,
    outputPerMillionUsd: 1.6,
    effectiveDate: "2025-04-14",
  },
};

export function resolveRoute(route: AiRouteId) {
  const envName = route === "openai_fast"
    ? "AI_MODEL_FAST"
    : route === "openai_balanced"
      ? "AI_MODEL_BALANCED"
      : "AI_MODEL_DEEP";
  const model = process.env[envName] || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const price = PRICES[model];
  if (!price && process.env.AI_ALLOW_UNPRICED_MODEL !== "1") {
    return { ok: false as const, reason: `No controlled price is registered for route ${route}.` };
  }
  return {
    ok: true as const,
    provider: "openai" as const,
    route,
    model,
    price: price ?? null,
  };
}

export function calculateCostUsd({
  model,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
}: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}) {
  const price = PRICES[model];
  if (!price) return null;
  const uncached = Math.max(0, inputTokens - cachedInputTokens);
  return (
    (uncached * price.inputPerMillionUsd
      + cachedInputTokens * price.cachedInputPerMillionUsd
      + outputTokens * price.outputPerMillionUsd) / 1_000_000
  );
}

export function getRegisteredPrice(model: string) {
  return PRICES[model] ?? null;
}
