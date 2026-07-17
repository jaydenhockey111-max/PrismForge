import "server-only";
import { createHash, randomUUID } from "node:crypto";

export function createAiRequestId(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : randomUUID();
}

export function hashPrivateValue(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(Buffer.byteLength(value, "utf8") / 4));
}

export function safeFailureReason(error: unknown) {
  if (!(error instanceof Error)) return "AI generation was unavailable.";
  const message = error.message.toLowerCase();
  if (message.includes("timeout") || error.name === "AbortError") return "The AI request timed out.";
  if (message.includes("rate limit") || message.includes("429")) return "The AI provider is temporarily busy.";
  if (message.includes("invalid") || message.includes("json")) return "The AI response could not be validated.";
  return "AI generation was unavailable.";
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
