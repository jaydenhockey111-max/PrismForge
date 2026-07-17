export type ModelTaskClass = "deterministic" | "frequent_creative" | "strategic" | "rare_deep_review";
export type FounderModelTask =
  | "quest_selection" | "guidance_adaptation" | "historical_relevance" | "validation_routing"
  | "video_scripts" | "outreach_copy" | "ceo_strategy" | "mvp_scope" | "pricing_strategy"
  | "founder_patterns_deep_review";

const ROUTES: Record<FounderModelTask, ModelTaskClass> = {
  quest_selection: "deterministic",
  guidance_adaptation: "deterministic",
  historical_relevance: "deterministic",
  validation_routing: "deterministic",
  video_scripts: "frequent_creative",
  outreach_copy: "frequent_creative",
  ceo_strategy: "strategic",
  mvp_scope: "strategic",
  pricing_strategy: "strategic",
  founder_patterns_deep_review: "rare_deep_review",
};

export function routeFounderModelTask(task: FounderModelTask, options: { explicitUserAction: boolean; featureAuthorized: boolean }) {
  const taskClass = ROUTES[task];
  const usesAi = taskClass !== "deterministic" && options.explicitUserAction && options.featureAuthorized;
  return { task, taskClass, usesAi, reason: usesAi ? "Explicit authorized generation." : taskClass === "deterministic" ? "Deterministic product logic." : "AI requires an explicit authorized action." };
}

