import type { ProductPlan } from "@/lib/billing/planLimits";
import type { FeatureUsageKey } from "@/lib/billing/featurePolicy";

export type AiTaskId = Exclude<FeatureUsageKey, "market_pulse_refresh" | "founder_brief">;
export type AiTaskClass = "fast" | "balanced" | "deep";
export type AiRouteId = "openai_fast" | "openai_balanced" | "openai_deep";

export type AiActor = {
  userId: string;
  plan: ProductPlan;
};

export type AiTaskDefinition = {
  id: AiTaskId;
  description: string;
  taskClass: AiTaskClass;
  route: AiRouteId;
  promptVersion: string;
  schemaVersion: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  cacheTtlSeconds: number;
  cachePolicy: "exact";
  userInitiatedOnly: true;
  requiresProject: boolean;
  minPlan: ProductPlan;
  dailyLimit: Record<ProductPlan, number>;
  monthlyLimit: Record<ProductPlan, number>;
  maxEstimatedCostUsd: number;
  burstLimitPerMinute: number;
  sustainedLimitPerTenMinutes: number;
  outputSchemaId: string;
  enabled: boolean;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export type AiProviderResult = {
  value: unknown;
  usage: AiUsage;
  providerRequestId: string | null;
  latencyMs: number;
  attempts: number;
};

export type AiFailureCategory =
  | "authentication"
  | "authorization"
  | "disabled"
  | "duplicate_in_progress"
  | "input_too_large"
  | "invalid_output"
  | "limit"
  | "pricing"
  | "provider_auth"
  | "provider_rate_limit"
  | "provider_timeout"
  | "provider_unavailable"
  | "repository_unavailable"
  | "unknown";

export type AiReservation =
  | { decision: "reserved"; ledgerId: string }
  | { decision: "cached"; ledgerId: string; value: unknown }
  | { decision: "duplicate"; ledgerId: string; status: string; value: unknown | null }
  | { decision: "blocked"; ledgerId: string | null; reason: string; category: AiFailureCategory };

export type AiExecutionContext = {
  actor?: AiActor;
  userId?: string | null;
  projectId?: string | null;
  requestId?: string;
  source?: string;
  cacheBypass?: boolean;
  synthetic?: boolean;
};

export type AiExecutionResult<T> = {
  value: T;
  mode: "openai" | "mock" | "cache";
  requestId: string;
  fallbackReason?: string;
  usage?: AiUsage;
};
