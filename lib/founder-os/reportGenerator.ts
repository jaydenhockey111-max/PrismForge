import "server-only";
import { generateJsonWithAI } from "@/lib/ai/generateWithAI";
import type { OpportunityReport, UserOpportunityInput } from "@/lib/founder-os/types";
import { cleanProjectTitle } from "@/lib/founder-os/titleQuality";
import { assertValidGeneratedReport } from "@/lib/founder-os/reportQuality";
export { createMockOpportunityReport } from "@/lib/founder-os/reportFallback";
import { createMockOpportunityReport } from "@/lib/founder-os/reportFallback";
import { buildPromptProjectContext, createProjectContext } from "@/lib/founder-os/projectContext";
import type { AiExecutionContext } from "@/lib/ai/platform/types";

export async function generateOpportunityReport(input: UserOpportunityInput, context?: AiExecutionContext): Promise<OpportunityReport> {
  const fallback = createMockOpportunityReport(input);
  const schemaGuide = createReportSchemaGuide(fallback);
  const compactContext = buildPromptProjectContext(createProjectContext({ report: fallback, status: "idea" }));
  const result = await generateJsonWithAI({
    feature: "opportunity_report",
    fallback,
    system: [
      "You are PrismForge's senior startup strategist.",
      "Return only valid compact JSON. No markdown.",
      "Make the project feel specific, non-generic, and different from other projects.",
      "Do not promise guaranteed revenue, scholarships, funding, or success.",
      "Separate user-provided facts from assumptions and hypotheses.",
      "Never invent real customers, research, market demand, validation, revenue, statistics, quotes, or customer complaints.",
      "Use 'Hypothesis:' for unverified customer pain, demand, competition, pricing, or revenue claims.",
      "Avoid placeholder phrasing like 'turn chaos into clarity' unless it is tied to the exact customer and pain.",
      "Prefer concrete customer pains, MVP flows, pricing, acquisition channels, and launch steps.",
      "Use language that fits the actual project type: students need study pilots, agencies need first-client offers, courses need lesson pilots, communities need engagement rituals.",
      "Do not restate the founder input as the answer; add judgment, tradeoffs, risk, evidence needed, or a specific next decision.",
      "If the founder wrote a strong specific idea, preserve the mechanics and improve around it instead of replacing it.",
    ].join(" "),
    user: JSON.stringify({
      task: "Create one unique PrismForge OpportunityReport for this founder input.",
      projectContext: compactContext,
      requiredShape: schemaGuide,
      qualityRules: [
        "Use a short memorable title, ideally 2-7 words.",
        "Use concise arrays: usually 3-5 items.",
        "Competitors may be likely alternatives or workaround categories; do not invent fake exact companies if unsure.",
        "Market validation must say what to test, not what has already been proven.",
        "Avoid generic startup words like MVP, traction, growth, customer acquisition, or launch when they do not fit the project context.",
        "Keep every section tailored to the target customer, pain point, budget, hours/week, skills, and goal.",
        "For each recommendation, make the constraint visible: smaller plan for low time/budget/risk, larger plan only for high capacity.",
        "Every roadmap item should include an action the founder can actually do, not a vague startup slogan.",
        "Return JSON only.",
      ],
    }),
    logContext: context,
    validate: (value) => assertValidGeneratedReport(deepMerge(fallback, {
      ...(value as Partial<OpportunityReport>),
      generatedAt: new Date().toISOString(),
      input,
      generationMode: "openai" as const,
    }), input),
  });

  const cleaned = normalizeReportTitle(result.value, input);
  if (result.mode === "openai") return { ...cleaned, generationMode: "openai" };
  return {
    ...cleaned,
    generationMode: "mock",
    fallbackReason: result.fallbackReason ?? "Local PrismForge report engine used.",
    marketValidation: {
      ...cleaned.marketValidation,
      confidenceNotes: [
        ...cleaned.marketValidation.confidenceNotes,
        result.fallbackReason ?? "Local PrismForge report engine used.",
      ],
    },
  };
}

function createReportSchemaGuide(fallback: OpportunityReport) {
  return {
    generatedAt: "ISO string",
    input: "same founderContext input object",
    score: Object.keys(fallback.score),
    summary: Object.keys(fallback.summary),
    marketValidation: Object.keys(fallback.marketValidation),
    competitors: [Object.keys(fallback.competitors[0])],
    mvpPlan: Object.keys(fallback.mvpPlan),
    monetizationPlan: Object.keys(fallback.monetizationPlan),
    contentPlan: Object.keys(fallback.contentPlan),
    landingPageCopy: Object.keys(fallback.landingPageCopy),
    executionRoadmap: Object.keys(fallback.executionRoadmap),
  };
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (!override || typeof override !== "object") return base;
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue;
    const baseValue = output[key];
    if (Array.isArray(value)) output[key] = value.length ? value : baseValue;
    else if (typeof value === "object" && value && typeof baseValue === "object" && baseValue && !Array.isArray(baseValue)) output[key] = deepMerge(baseValue, value as Record<string, unknown>);
    else output[key] = value;
  }
  return output as T;
}

function normalizeReportTitle(report: OpportunityReport, input: UserOpportunityInput): OpportunityReport {
  const title = cleanProjectTitle(report.summary.title, {
    audience: report.summary.targetCustomer || input.targetAudience,
    painPoint: report.summary.painPoint,
    businessType: input.businessType,
    interests: input.interests,
    skills: input.skills,
    existingIdea: input.existingIdea,
  }).title;

  return {
    ...report,
    summary: {
      ...report.summary,
      title,
    },
  };
}
