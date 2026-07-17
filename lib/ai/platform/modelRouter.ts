import "server-only";
import { resolveRoute } from "@/lib/ai/platform/pricing";
import type { AiTaskDefinition } from "@/lib/ai/platform/types";

export function routeAiTask(task: AiTaskDefinition) {
  if (!task.enabled) return { ok: false as const, reason: "This AI task is temporarily disabled." };
  if (task.taskClass === "deep" && process.env.AI_DISABLE_DEEP === "1") {
    return { ok: false as const, reason: "Deep AI generation is temporarily disabled." };
  }
  return resolveRoute(task.route);
}
