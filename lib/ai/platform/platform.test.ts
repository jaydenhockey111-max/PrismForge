import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCostUsd, getRegisteredPrice, resolveRoute } from "@/lib/ai/platform/pricing";
import { estimateTokens, hashPrivateValue, safeFailureReason, stableStringify } from "@/lib/ai/platform/privacy";
import { AI_TASKS, isAiTaskId } from "@/lib/ai/platform/registry";

describe("central AI platform registries", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("registers every production provider task and excludes deterministic-only features", () => {
    expect(Object.keys(AI_TASKS)).toHaveLength(10);
    expect(isAiTaskId("opportunity_report")).toBe(true);
    expect(isAiTaskId("market_pulse_refresh")).toBe(false);
    expect(isAiTaskId("founder_brief")).toBe(false);
    for (const task of Object.values(AI_TASKS)) {
      expect(task.promptVersion).toMatch(/^\d{4}-\d{2}-\d{2}\./);
      expect(task.maxInputTokens).toBeGreaterThan(0);
      expect(task.maxOutputTokens).toBeGreaterThan(0);
      expect(task.maxEstimatedCostUsd).toBeGreaterThan(0);
      expect(task.outputSchemaId).toContain(task.id);
      expect(task.userInitiatedOnly).toBe(true);
      expect(task.enabled).toBe(true);
    }
  });

  it("fails closed when an environment route selects an unpriced model", () => {
    vi.stubEnv("AI_MODEL_FAST", "unknown-expensive-model");
    vi.stubEnv("AI_ALLOW_UNPRICED_MODEL", "");
    expect(resolveRoute("openai_fast")).toMatchObject({ ok: false });
  });

  it("uses the controlled gpt-4.1-mini price including cached input", () => {
    expect(getRegisteredPrice("gpt-4.1-mini")).toMatchObject({
      inputPerMillionUsd: 0.4,
      cachedInputPerMillionUsd: 0.1,
      outputPerMillionUsd: 1.6,
    });
    expect(calculateCostUsd({
      model: "gpt-4.1-mini",
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(1.85, 8);
  });
});

describe("AI privacy and deterministic request identity", () => {
  it("canonicalizes object key order before hashing private input", () => {
    const left = { task: "test", payload: { b: 2, a: 1 } };
    const right = { payload: { a: 1, b: 2 }, task: "test" };
    expect(stableStringify(left)).toBe(stableStringify(right));
    expect(hashPrivateValue(left)).toBe(hashPrivateValue(right));
    expect(hashPrivateValue(left)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPrivateValue(left)).not.toContain("payload");
  });

  it("estimates UTF-8 prompt size conservatively and never returns zero", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
    expect(estimateTokens("🚀".repeat(10))).toBe(10);
  });

  it("does not expose raw provider errors or secrets to users", () => {
    const safe = safeFailureReason(new Error("Bearer sk-secret customer@example.com failed"));
    expect(safe).toBe("AI generation was unavailable.");
    expect(safe).not.toContain("sk-secret");
    expect(safe).not.toContain("customer@example.com");
  });
});
