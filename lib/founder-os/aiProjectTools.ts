import "server-only";
import { generateJsonWithAI } from "@/lib/ai/generateWithAI";
import { generateCeoDirective } from "@/lib/founder-os/ceoDirective";
import {
  generateCompetitiveBattlecard,
  generatePricingTiers,
  generateSprintTasks,
  generateValidationSurvey,
  generateVideoScripts,
  type CompetitiveBattlecardRow,
  type PricingTierOutput,
  type SprintTaskOutput,
  type ValidationSurveyOutput,
} from "@/lib/founder-os/executionTools";
import type { ProjectOutputType } from "@/lib/database.types";
import type { FeatureUsageKey } from "@/lib/billing/featurePolicy";
import type { OpportunityReport, ProjectStatus, VideoScriptConcept } from "@/lib/founder-os/types";
import { cleanSentence, shortProjectName } from "@/lib/founder-os/helpers";
import { cleanProjectTitle } from "@/lib/founder-os/titleQuality";
import { buildPromptProjectContext, createProjectContext } from "@/lib/founder-os/projectContext";
import { cleanGeneratedCopy, cleanGeneratedList, cleanGeneratedMarkdown, cleanHeading } from "@/lib/founder-os/copyQuality";

export type AiExecutionOutput =
  | ValidationSurveyOutput
  | CompetitiveBattlecardRow[]
  | PricingTierOutput[]
  | VideoScriptConcept[]
  | SprintTaskOutput[];

export type StartupTeamEmployee = "ceo" | "marketer" | "designer" | "engineer";

export type WireframeOutput = {
  markdown: string;
  steps: Array<{ component: string; purpose: string; structure: string[] }>;
};

export type EngineerOutput = {
  componentName: string;
  code: string;
};

export type GtmPlan = {
  positioningStatement: string;
  channels: Array<{ name: string; why: string; firstAction: string }>;
  first100UsersPlan: string[];
  launchPost: string;
  videoHooks: string[];
  coldMessages: string[];
  riskWarning: string;
};

export async function generateExecutionOutputWithAI(report: OpportunityReport, outputType: ProjectOutputType, context?: { userId?: string | null; projectId?: string | null }) {
  const fallback = executionFallback(report, outputType);
  return generateJsonWithAI({
    feature: executionFeature(outputType),
    fallback,
    system: "You are PrismForge's startup operator. Return compact valid JSON only. Add a clear decision, risk, next action, or evidence plan; do not merely restate the founder input.",
    user: JSON.stringify({
      task: outputType,
      shape: executionShape(outputType),
      project: projectBrief(report, "idea"),
    }),
    logContext: context,
    validate: (value) => normalizeExecutionOutput(value, fallback, outputType),
  });
}

export async function generateStartupTeamOutputWithAI({
  employee,
  report,
  status,
  sprintTasks,
  context,
  founderIntelligence,
}: {
  employee: StartupTeamEmployee;
  report: OpportunityReport;
  status: ProjectStatus;
  sprintTasks?: SprintTaskOutput[];
  context?: { userId?: string | null; projectId?: string | null };
  founderIntelligence?: {
    guidanceMode: string;
    explanationDepth: string;
    questIntensity: string;
    constraints: Record<string, unknown>;
    relevantPatterns: Array<{ category: string; observation: string; evidenceTier: string }>;
    caveat: string;
  };
}) {
  const fallback = startupFallback(employee, report, status, sprintTasks);
  const feature = employee === "ceo" ? "ceo_ai" : employee === "marketer" ? "marketer_ai" : employee === "designer" ? "designer_ai" : "engineer_ai";
  return generateJsonWithAI({
    feature,
    fallback,
    system: "You are a PrismForge specialist. Return compact valid JSON only. Use the provided project context, founder constraints, and evidence state. Prioritize one useful recommendation; avoid generic startup templates and raw input restatement.",
    user: JSON.stringify({
      employee,
      shape: startupShape(employee),
      status,
      sprintTasks: (sprintTasks ?? []).slice(0, 3),
      project: projectBrief(report, status),
      founderGuidance: founderIntelligence,
    }),
    logContext: context,
    validate: (value) => normalizeStartupOutput(value, fallback, employee),
  });
}

function executionFeature(outputType: ProjectOutputType): FeatureUsageKey {
  if (outputType === "validation_survey") return "validation_survey";
  if (outputType === "competitive_battlecard") return "competitive_battlecard";
  if (outputType === "pricing_tiers") return "pricing_tiers";
  if (outputType === "video_scripts") return "video_scripts";
  return "sprint_tasks";
}

function executionFallback(report: OpportunityReport, outputType: ProjectOutputType): AiExecutionOutput {
  if (outputType === "validation_survey") return generateValidationSurvey(report);
  if (outputType === "competitive_battlecard") return generateCompetitiveBattlecard(report);
  if (outputType === "pricing_tiers") return generatePricingTiers(report);
  if (outputType === "video_scripts") return generateVideoScripts(report);
  if (outputType === "sprint_tasks") return generateSprintTasks(report);
  return generateSprintTasks(report);
}

function startupFallback(employee: StartupTeamEmployee, report: OpportunityReport, status: ProjectStatus, sprintTasks?: SprintTaskOutput[]) {
  if (employee === "ceo") return generateCeoDirective({ status, report, sprintTasks });
  if (employee === "marketer") return fallbackGtmPlan(report, status);
  if (employee === "designer") return fallbackWireframe(report);
  return fallbackEngineer(report);
}

export function generateLocalExecutionOutput(report: OpportunityReport, outputType: ProjectOutputType) {
  return executionFallback(report, outputType);
}

export function generateLocalStartupTeamOutput(employee: StartupTeamEmployee, report: OpportunityReport, status: ProjectStatus, sprintTasks?: SprintTaskOutput[]) {
  return startupFallback(employee, report, status, sprintTasks);
}

function normalizeExecutionOutput(value: unknown, fallback: AiExecutionOutput, outputType: ProjectOutputType): AiExecutionOutput {
  if (outputType === "validation_survey" && isRecord(value)) {
    return {
      questions: cleanGeneratedList(asStringArray(value.questions, (fallback as ValidationSurveyOutput).questions).slice(0, 5)),
      outreachMessage: cleanGeneratedCopy(asString(value.outreachMessage, (fallback as ValidationSurveyOutput).outreachMessage)),
    };
  }
  if (outputType === "competitive_battlecard" && Array.isArray(value)) {
    return value.slice(0, 3).map((row, index) => ({
      competitor: cleanHeading(asString((row as Record<string, unknown>).competitor, (fallback as CompetitiveBattlecardRow[])[index]?.competitor ?? "Competitor"), 80),
      likelyWeakness: cleanGeneratedCopy(asString((row as Record<string, unknown>).likelyWeakness, (fallback as CompetitiveBattlecardRow[])[index]?.likelyWeakness ?? "Unclear workflow")),
      counterAdvantage: cleanGeneratedCopy(asString((row as Record<string, unknown>).counterAdvantage, (fallback as CompetitiveBattlecardRow[])[index]?.counterAdvantage ?? "Narrower positioning")),
    }));
  }
  if (outputType === "pricing_tiers" && Array.isArray(value)) {
    return value.slice(0, 3).map((tier, index) => ({
      name: cleanHeading(asString((tier as Record<string, unknown>).name, (fallback as PricingTierOutput[])[index]?.name ?? "Pro"), 32),
      price: asString((tier as Record<string, unknown>).price, (fallback as PricingTierOutput[])[index]?.price ?? "$19/mo"),
      positioning: cleanGeneratedCopy(asString((tier as Record<string, unknown>).positioning, (fallback as PricingTierOutput[])[index]?.positioning ?? "For serious users.")),
      features: cleanGeneratedList(asStringArray((tier as Record<string, unknown>).features, (fallback as PricingTierOutput[])[index]?.features ?? []).slice(0, 5)),
    }));
  }
  if (outputType === "video_scripts" && Array.isArray(value)) {
    return value.slice(0, 3).map((script, index) => ({
      day: Number((script as Record<string, unknown>).day ?? index + 1),
      hook: cleanGeneratedCopy(asString((script as Record<string, unknown>).hook, (fallback as VideoScriptConcept[])[index]?.hook ?? "Start with the pain.")),
      bodyScript: cleanGeneratedCopy(asString((script as Record<string, unknown>).bodyScript, (fallback as VideoScriptConcept[])[index]?.bodyScript ?? "Explain the core value.")),
      cta: cleanGeneratedCopy(asString((script as Record<string, unknown>).cta, (fallback as VideoScriptConcept[])[index]?.cta ?? "Join the waitlist.")),
    }));
  }
  if (outputType === "sprint_tasks" && Array.isArray(value)) {
    return value.slice(0, 3).map((task, index) => ({
      category: normalizeTaskCategory((task as Record<string, unknown>).category, (fallback as SprintTaskOutput[])[index]?.category),
      task: cleanGeneratedCopy(asString((task as Record<string, unknown>).task, (fallback as SprintTaskOutput[])[index]?.task ?? "Talk to users.")),
      whyItMatters: cleanGeneratedCopy(asString((task as Record<string, unknown>).whyItMatters, (fallback as SprintTaskOutput[])[index]?.whyItMatters ?? "It creates evidence.")),
    }));
  }
  return fallback;
}

function normalizeStartupOutput(value: unknown, fallback: unknown, employee: StartupTeamEmployee) {
  if (!isRecord(value)) return fallback;
  if (employee === "marketer") {
    const base = fallback as GtmPlan;
    return {
      positioningStatement: cleanGeneratedCopy(asString(value.positioningStatement, base.positioningStatement)),
      channels: Array.isArray(value.channels) ? value.channels.slice(0, 3).map((channel, index) => ({
        name: cleanHeading(asString((channel as Record<string, unknown>).name, base.channels[index]?.name ?? "cold email/DM"), 48),
        why: cleanGeneratedCopy(asString((channel as Record<string, unknown>).why, base.channels[index]?.why ?? "Direct validation is fastest.")),
        firstAction: cleanGeneratedCopy(asString((channel as Record<string, unknown>).firstAction, base.channels[index]?.firstAction ?? "Send 10 research DMs.")),
      })) : base.channels,
      first100UsersPlan: cleanGeneratedList(asStringArray(value.first100UsersPlan, base.first100UsersPlan).slice(0, 5)),
      launchPost: cleanGeneratedCopy(asString(value.launchPost, base.launchPost)),
      videoHooks: cleanGeneratedList(asStringArray(value.videoHooks, base.videoHooks).slice(0, 3)),
      coldMessages: cleanGeneratedList(asStringArray(value.coldMessages, base.coldMessages).slice(0, 3)),
      riskWarning: cleanGeneratedCopy(asString(value.riskWarning, base.riskWarning)),
    };
  }
  if (employee === "designer") {
    const base = fallback as WireframeOutput;
    const steps = Array.isArray(value.steps) ? value.steps.slice(0, 3).map((step, index) => ({
      component: cleanHeading(asString((step as Record<string, unknown>).component, base.steps[index]?.component ?? "Component"), 96),
      purpose: cleanGeneratedCopy(asString((step as Record<string, unknown>).purpose, base.steps[index]?.purpose ?? "Move the user forward.")),
      structure: cleanGeneratedList(asStringArray((step as Record<string, unknown>).structure, base.steps[index]?.structure ?? []).slice(0, 5)),
    })) : base.steps;
    return { markdown: cleanGeneratedMarkdown(asString(value.markdown, wireframeMarkdown(projectTitleFromBrief(base.markdown), steps))), steps };
  }
  if (employee === "engineer") {
    const base = fallback as EngineerOutput;
    return {
      componentName: cleanHeading(asString(value.componentName, base.componentName), 64).replace(/\s+/g, ""),
      code: asString(value.code, base.code),
    };
  }
  return {
    phase: cleanHeading(asString(value.phase, (fallback as Record<string, string>).phase), 48),
    priority: cleanGeneratedCopy(asString(value.priority, (fallback as Record<string, string>).priority)),
    selectedTask: cleanGeneratedCopy(asString(value.selectedTask, (fallback as Record<string, string>).selectedTask)),
    rationale: cleanGeneratedCopy(asString(value.rationale, (fallback as Record<string, string>).rationale)),
    founderWarning: cleanGeneratedCopy(asString(value.founderWarning, (fallback as Record<string, string>).founderWarning)),
    nextCheckIn: cleanGeneratedCopy(asString(value.nextCheckIn, (fallback as Record<string, string>).nextCheckIn)),
  };
}

function executionShape(outputType: ProjectOutputType) {
  const shapes: Record<string, unknown> = {
    validation_survey: { questions: ["string x5"], outreachMessage: "string" },
    competitive_battlecard: [{ competitor: "string", likelyWeakness: "string", counterAdvantage: "string" }],
    pricing_tiers: [{ name: "Free | Pro | Founder", price: "string", positioning: "string", features: ["string"] }],
    video_scripts: [{ day: 1, hook: "string", bodyScript: "string", cta: "string" }],
    sprint_tasks: [{ category: "Technical | Marketing | Validation", task: "string", whyItMatters: "string" }],
  };
  return shapes[outputType];
}

function startupShape(employee: StartupTeamEmployee) {
  const shapes = {
    ceo: { phase: "string", priority: "string", selectedTask: "string", rationale: "string", founderWarning: "string", nextCheckIn: "string" },
    marketer: { positioningStatement: "string", channels: [{ name: "string", why: "string", firstAction: "string" }], first100UsersPlan: ["string x5"], launchPost: "string", videoHooks: ["string x3"], coldMessages: ["string x3"], riskWarning: "string" },
    designer: { markdown: "string", steps: [{ component: "string", purpose: "string", structure: ["string"] }] },
    engineer: { componentName: "string", code: "string React/Tailwind component" },
  };
  return shapes[employee];
}

function projectBrief(report: OpportunityReport, status: ProjectStatus) {
  const context = createProjectContext({ report, status });
  const title = cleanProjectTitle(report.summary.title, {
    audience: report.summary.targetCustomer,
    painPoint: report.summary.painPoint,
    businessType: report.input.businessType,
    interests: report.input.interests,
    skills: report.input.skills,
    existingIdea: report.input.existingIdea,
  }).title;
  return {
    ...buildPromptProjectContext(context),
    title,
    mvpSummary: report.mvpPlan.mustHaveFeatures.slice(0, 3).join("; "),
    pricingSummary: `${report.monetizationPlan.suggestedPrice}; ${report.monetizationPlan.whyUsersWouldPay}`,
    landingHeadline: report.landingPageCopy.heroHeadline,
    contentHooks: report.contentPlan.shortFormHooks.slice(0, 3),
    competitors: report.competitors.slice(0, 3).map((competitor) => ({ name: competitor.name, weakness: competitor.weakness })),
    score: report.score.overall,
  };
}

function fallbackGtmPlan(report: OpportunityReport, status: ProjectStatus): GtmPlan {
  const context = createProjectContext({ report, status });
  const projectName = shortProjectName(report.summary.title);
  const target = cleanSentence(context.audience || "your target audience").toLowerCase();
  const pain = cleanSentence(report.summary.painPoint || "this problem");
  const painLower = pain.toLowerCase();
  const benefit = cleanSentence(report.landingPageCopy.subheadline || report.summary.oneSentenceIdea);
  const risk: Record<ProjectStatus, string> = {
    idea: `Do not overbuild before ${context.language.validationVerb}.`,
    validating: `Do not hide behind planning; get a real response from ${context.language.userNoun}.`,
    building: `Do not add more scope before the first ${context.language.releaseNoun} test.`,
    launched: "Do not ignore retention, feedback, and repeat usage.",
  };
  return {
    positioningStatement: `For ${target} who struggle with ${painLower}, ${projectName} helps them ${lowercaseFirst(benefit)}.`,
    channels: [
      { name: firstChannelForContext(context), why: `This fits a ${context.projectType} because it can produce ${context.language.firstProofTarget} without heavy build work.`, firstAction: context.recommendedValidation[0] ?? `Ask 5 ${context.language.userNoun} about the pain.` },
      { name: "cold email/DM", why: `Direct conversations create the fastest evidence from ${context.language.userNoun}.`, firstAction: `Message 10 ${target} and ask about the problem.` },
      { name: "TikTok/Reels/Shorts", why: "Short hooks can test pain-point language quickly.", firstAction: `Post this hook: ${report.contentPlan.shortFormHooks[0] ?? report.contentPlan.shockValueAngle}` },
    ],
    first100UsersPlan: [
      context.recommendedValidation[0] ?? `Interview 5 ${context.language.userNoun}.`,
      `Create one tiny ${context.language.releaseNoun} promise.`,
      `Send 10 research messages to ${context.language.userNoun}.`,
      "Post 3 pain-point hooks.",
      `Invite 10 people into the first ${context.language.releaseNoun}.`,
    ],
    launchPost: `I'm testing ${projectName} for ${target}. It helps with ${painLower}. Reply if you want to try the early ${context.language.releaseNoun}.`,
    videoHooks: report.contentPlan.shortFormHooks.slice(0, 3),
    coldMessages: [
      `Hey - quick question. Do you ever struggle with ${painLower}?`,
      `I'm validating ${projectName} for ${target}. Could I ask 2 quick questions?`,
      `Would a tool that helps you ${lowercaseFirst(benefit)} be useful?`,
    ],
    riskWarning: risk[status],
  };
}

function fallbackWireframe(report: OpportunityReport): WireframeOutput {
  const context = createProjectContext({ report, status: "building" });
  const steps = [
    { component: "Component 1: Contextual Hero Section", purpose: `Capture the first useful action from ${context.language.userNoun}.`, structure: [report.landingPageCopy.heroHeadline, `Input for the ${context.solutionCategory.toLowerCase()} problem`, `CTA: ${report.landingPageCopy.cta}`] },
    { component: "Component 2: Reactive Grid List", purpose: "Show progress and recommended next steps.", structure: ["Three-card recommendation grid", "Score/status badge", "Helpful empty state"] },
    { component: "Component 3: Action Drawer", purpose: "Turn insight into execution.", structure: ["Slide-over task drawer", "MVP checklist", "Sticky save/continue button"] },
  ];
  return { markdown: wireframeMarkdown(report.summary.title, steps), steps };
}

function fallbackEngineer(report: OpportunityReport): EngineerOutput {
  const context = createProjectContext({ report, status: "building" });
  return {
    componentName: "MvpHeroInputSection",
    code: `export function MvpHeroInputSection() {
  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <p className="text-xs font-black uppercase tracking-[.16em] text-violet">${escapeForCode(context.solutionCategory)}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">${escapeForCode(report.landingPageCopy.heroHeadline)}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">${escapeForCode(report.summary.oneSentenceIdea)}</p>
      <button className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-black text-white">
        ${escapeForCode(report.landingPageCopy.cta)}
      </button>
    </section>
  );
}`,
  };
}

function firstChannelForContext(context: ReturnType<typeof createProjectContext>) {
  if (context.projectType === "Education Tool" || context.solutionCategory === "Education") return "school/startup communities";
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") return "cold email/DM";
  if (context.projectType === "Community") return "niche Discords";
  if (context.projectType === "Content Brand" || context.projectType === "Creator Business") return "TikTok/Reels/Shorts";
  if (context.projectType === "B2B Software") return "LinkedIn";
  return "Reddit";
}

function wireframeMarkdown(title: string, steps: WireframeOutput["steps"]) {
  return [`# UI/UX Wireframe Map: ${title}`, "", ...steps.flatMap((step) => [`## ${step.component}`, `**Purpose:** ${step.purpose}`, "", ...step.structure.map((item) => `- ${item}`), ""])].join("\n").trim();
}

function normalizeTaskCategory(value: unknown, fallback: SprintTaskOutput["category"] = "Validation"): SprintTaskOutput["category"] {
  return value === "Technical" || value === "Marketing" || value === "Validation" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : fallback;
}

function lowercaseFirst(value: string) {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function escapeForCode(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/\n/g, " ");
}

function projectTitleFromBrief(markdown: string) {
  return markdown.split(":").at(1)?.split("\n").at(0)?.trim() || "Project";
}
