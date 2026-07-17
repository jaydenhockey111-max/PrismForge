import "server-only";
import { FEATURE_USAGE_POLICIES } from "@/lib/billing/featurePolicy";
import { PLAN_LIMITS, type ProductPlan } from "@/lib/billing/planLimits";
import type { AiRouteId, AiTaskDefinition, AiTaskId } from "@/lib/ai/platform/types";

const descriptions: Record<AiTaskId, string> = {
  opportunity_report: "Create a founder opportunity report after an explicit generation request.",
  ceo_ai: "Recommend the next founder priority.",
  marketer_ai: "Create a compact go-to-market plan.",
  designer_ai: "Create a compact product wireframe.",
  engineer_ai: "Create a compact implementation starting point.",
  validation_survey: "Create a customer validation survey.",
  competitive_battlecard: "Create a competitive alternatives battlecard.",
  pricing_tiers: "Create pricing tier hypotheses.",
  video_scripts: "Create short-form video script hypotheses.",
  sprint_tasks: "Create a focused execution sprint.",
};

const balancedTasks = new Set<AiTaskId>(["opportunity_report", "ceo_ai", "marketer_ai"]);

export const AI_TASKS = Object.freeze(
  Object.fromEntries(
    (Object.keys(descriptions) as AiTaskId[]).map((id) => {
      const policy = FEATURE_USAGE_POLICIES[id];
      const route: AiRouteId = balancedTasks.has(id) ? "openai_balanced" : "openai_fast";
      const definition: AiTaskDefinition = {
        id,
        description: descriptions[id],
        taskClass: balancedTasks.has(id) ? "balanced" : "fast",
        route,
        promptVersion: "2026-07-17.1",
        schemaVersion: "1",
        maxInputTokens: id === "opportunity_report" ? 8_000 : 5_000,
        maxOutputTokens: policy.maxOutputTokens,
        timeoutMs: boundedNumber(process.env.OPENAI_REQUEST_TIMEOUT_MS, 18_000, 5_000, 45_000),
        cacheTtlSeconds: id === "opportunity_report" ? 86_400 : 21_600,
        cachePolicy: "exact",
        userInitiatedOnly: true,
        requiresProject: id !== "opportunity_report",
        minPlan: policy.minPlan,
        dailyLimit: {
          free: id === "opportunity_report" ? 3 : 0,
          pro: id === "opportunity_report" ? 10 : 20,
          founder: id === "opportunity_report" ? 20 : 50,
        },
        monthlyLimit: policy.monthlyOpenAiLimit,
        maxEstimatedCostUsd: id === "opportunity_report" ? 0.01 : 0.008,
        burstLimitPerMinute: 1,
        sustainedLimitPerTenMinutes: id === "opportunity_report" ? 3 : 2,
        outputSchemaId: `${id}.v1`,
        enabled: true,
      };
      return [id, definition];
    }),
  ) as Record<AiTaskId, AiTaskDefinition>,
);

export const GLOBAL_AI_LIMITS = Object.freeze({
  dailyRequestsByPlan: {
    free: PLAN_LIMITS.free.aiEmployeeActionsPerDay,
    pro: PLAN_LIMITS.pro.aiEmployeeActionsPerDay,
    founder: PLAN_LIMITS.founder.aiEmployeeActionsPerDay,
  } satisfies Record<ProductPlan, number>,
  monthlyRequests: boundedNumber(process.env.BETA_TOTAL_OPENAI_GENERATIONS_PER_MONTH, 50, 1, 10_000),
  softDailyUsd: boundedNumber(process.env.AI_GLOBAL_SOFT_DAILY_USD, 1.5, 0, 100_000),
  hardDailyUsd: boundedNumber(process.env.AI_GLOBAL_HARD_DAILY_USD, 2, 0.01, 100_000),
  softMonthlyUsd: boundedNumber(process.env.AI_GLOBAL_SOFT_MONTHLY_USD, 20, 0, 1_000_000),
  hardMonthlyUsd: boundedNumber(process.env.AI_GLOBAL_HARD_MONTHLY_USD, 25, 0.01, 1_000_000),
  requestsPerMinute: boundedNumber(process.env.AI_GLOBAL_REQUESTS_PER_MINUTE, 30, 1, 100_000),
});

export function getAiTask(id: AiTaskId) {
  return AI_TASKS[id];
}

export function isAiTaskId(value: string): value is AiTaskId {
  return Object.prototype.hasOwnProperty.call(AI_TASKS, value);
}

export function isPlanAllowed(plan: ProductPlan, minimum: ProductPlan) {
  const rank: Record<ProductPlan, number> = { free: 0, pro: 1, founder: 2 };
  return rank[plan] >= rank[minimum];
}

function boundedNumber(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}
