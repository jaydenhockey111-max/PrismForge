"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Check, Code2, Copy, Crown, Loader2, Megaphone, Palette, Sparkles } from "lucide-react";
import { generateStartupTeamOutput } from "@/app/(app)/projects/actions";
import { ceoLiveStatus, generateCeoDirective, type CeoDirective } from "@/lib/founder-os/ceoDirective";
import { cleanGeneratedObject, cleanHeading } from "@/lib/founder-os/copyQuality";
import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";

type WireframeStep = {
  component: string;
  purpose: string;
  structure: string[];
};

export type WireframeOutput = {
  markdown: string;
  steps: WireframeStep[];
};

export type EngineerOutput = {
  componentName: string;
  code: string;
};

type GtmChannel = {
  name: string;
  why: string;
  firstAction: string;
};

export type GtmPlan = {
  positioningStatement: string;
  channels: GtmChannel[];
  first100UsersPlan: string[];
  launchPost: string;
  videoHooks: string[];
  coldMessages: string[];
  riskWarning: string;
};

export function StartupTeamWorkspace({
  projectId,
  projectTitle,
  status,
  report,
  sprintTasks,
  savedOutputs,
  personalizationReasons = [],
}: {
  projectId: string;
  projectTitle: string;
  status: ProjectStatus;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
  personalizationReasons?: string[];
  savedOutputs?: {
    ceo?: CeoDirective | null;
    marketer?: GtmPlan | null;
    designer?: WireframeOutput | null;
    engineer?: EngineerOutput | null;
  };
}) {
  const [ceoPending, setCeoPending] = useState(false);
  const [marketerPending, setMarketerPending] = useState(false);
  const [designerPending, setDesignerPending] = useState(false);
  const [engineerPending, setEngineerPending] = useState(false);
  const [directive, setDirective] = useState<CeoDirective | null>(savedOutputs?.ceo ?? null);
  const [gtmPlan, setGtmPlan] = useState<GtmPlan | null>(savedOutputs?.marketer ?? null);
  const [wireframe, setWireframe] = useState<WireframeOutput | null>(savedOutputs?.designer ?? null);
  const [boilerplate, setBoilerplate] = useState<EngineerOutput | null>(savedOutputs?.engineer ?? null);
  const [aiMode, setAiMode] = useState<"openai" | "mock" | "cache" | null>(null);
  const [aiFallbackReason, setAiFallbackReason] = useState<string | null>(null);
  const liveStatus = useMemo(() => ceoLiveStatus({ status, report, sprintTasks }), [status, report, sprintTasks]);
  const hasSavedStartupOutputs = Boolean(savedOutputs?.ceo || savedOutputs?.marketer || savedOutputs?.designer || savedOutputs?.engineer);

  useEffect(() => {
    logClientEvent("ai_employee_opened", projectId, { employee: "startup_team" });
  }, [projectId]);

  useEffect(() => {
    if (hasSavedStartupOutputs) {
      setAiMode("cache");
      setAiFallbackReason("Cached AI Employee output loaded from Founder CRM memory.");
      logClientEvent("ai_employee_cache_hit", projectId, { employee: "startup_team", source: "database" });
      return;
    }

    try {
      const cachedCeo = readStartupCache<CeoDirective>(projectId, "ceo");
      const cachedMarketer = readStartupCache<GtmPlan>(projectId, "marketer");
      const cachedDesigner = readStartupCache<WireframeOutput>(projectId, "designer");
      const cachedEngineer = readStartupCache<EngineerOutput>(projectId, "engineer");
      if (cachedCeo) setDirective(cachedCeo);
      if (cachedMarketer) setGtmPlan(cachedMarketer);
      if (cachedDesigner) setWireframe(cachedDesigner);
      if (cachedEngineer) setBoilerplate(cachedEngineer);
      if (cachedCeo || cachedMarketer || cachedDesigner || cachedEngineer) {
        setAiMode("cache");
        setAiFallbackReason("Cached AI Employee output loaded from this browser.");
        logClientEvent("ai_employee_cache_hit", projectId, { employee: "startup_team", source: "local_storage" });
      }
    } catch {
      // Cache is an optimization only.
    }
  }, [hasSavedStartupOutputs, projectId]);

  async function consultCeo() {
    if (ceoPending) return;
    if (directive && !confirmRegenerate()) return;
    const startedAt = performance.now();
    logClientEvent("ai_employee_started", projectId, { employee: "ceo", regenerate: Boolean(directive) });
    setCeoPending(true);
    setDirective(null);
    setAiMode(null);
    setAiFallbackReason(null);
    try {
      const result = await generateStartupTeamOutput(projectId, "ceo", Boolean(directive));
      const output = result.output as unknown as CeoDirective;
      setDirective(output);
      writeStartupCache(projectId, "ceo", output);
      setAiMode(result.mode);
      setAiFallbackReason(result.fallbackReason);
      logClientEvent(result.mode === "cache" ? "ai_employee_cache_hit" : "ai_employee_completed", projectId, { employee: "ceo", source: result.mode, duration_ms: Math.round(performance.now() - startedAt) });
    } catch {
      setCeoPending(false);
      const output = cleanGeneratedObject(generateCeoDirective({ status, report, sprintTasks }));
      setDirective(output);
      writeStartupCache(projectId, "ceo", output);
      setAiMode("mock");
      setAiFallbackReason("Server AI generation failed; local CEO fallback was used.");
      logClientEvent("ai_employee_completed", projectId, { employee: "ceo", source: "mock", duration_ms: Math.round(performance.now() - startedAt) });
      return;
    }
    setCeoPending(false);
  }

  async function requestWireframe() {
    if (designerPending) return;
    if (wireframe && !confirmRegenerate()) return;
    const startedAt = performance.now();
    logClientEvent("ai_employee_started", projectId, { employee: "designer", regenerate: Boolean(wireframe) });
    setDesignerPending(true);
    setAiMode(null);
    setAiFallbackReason(null);
    try {
      const result = await generateStartupTeamOutput(projectId, "designer", Boolean(wireframe));
      const output = result.output as unknown as WireframeOutput;
      setWireframe(output);
      writeStartupCache(projectId, "designer", output);
      setAiMode(result.mode);
      setAiFallbackReason(result.fallbackReason);
      logClientEvent(result.mode === "cache" ? "ai_employee_cache_hit" : "ai_employee_completed", projectId, { employee: "designer", source: result.mode, duration_ms: Math.round(performance.now() - startedAt) });
    } catch {
      const output = cleanGeneratedObject(generateWireframeMap(report));
      setWireframe(output);
      writeStartupCache(projectId, "designer", output);
      setAiMode("mock");
      setAiFallbackReason("Server AI generation failed; local Designer fallback was used.");
      logClientEvent("ai_employee_completed", projectId, { employee: "designer", source: "mock", duration_ms: Math.round(performance.now() - startedAt) });
    } finally {
      setDesignerPending(false);
    }
  }

  async function generateMarketingPlan() {
    if (marketerPending) return;
    if (gtmPlan && !confirmRegenerate()) return;
    const startedAt = performance.now();
    logClientEvent("ai_employee_started", projectId, { employee: "marketer", regenerate: Boolean(gtmPlan) });
    setMarketerPending(true);
    setAiMode(null);
    setAiFallbackReason(null);
    try {
      const result = await generateStartupTeamOutput(projectId, "marketer", Boolean(gtmPlan));
      const output = result.output as unknown as GtmPlan;
      setGtmPlan(output);
      writeStartupCache(projectId, "marketer", output);
      setAiMode(result.mode);
      setAiFallbackReason(result.fallbackReason);
      logClientEvent(result.mode === "cache" ? "ai_employee_cache_hit" : "ai_employee_completed", projectId, { employee: "marketer", source: result.mode, duration_ms: Math.round(performance.now() - startedAt) });
    } catch {
      const output = cleanGeneratedObject(generateGtmPlan(projectTitle, status, report));
      setGtmPlan(output);
      writeStartupCache(projectId, "marketer", output);
      setAiMode("mock");
      setAiFallbackReason("Server AI generation failed; local Marketer fallback was used.");
      logClientEvent("ai_employee_completed", projectId, { employee: "marketer", source: "mock", duration_ms: Math.round(performance.now() - startedAt) });
    } finally {
      setMarketerPending(false);
    }
  }

  async function generateBoilerplate() {
    if (engineerPending) return;
    if (boilerplate && !confirmRegenerate()) return;
    const startedAt = performance.now();
    logClientEvent("ai_employee_started", projectId, { employee: "engineer", regenerate: Boolean(boilerplate) });
    setEngineerPending(true);
    setAiMode(null);
    setAiFallbackReason(null);
    try {
      const result = await generateStartupTeamOutput(projectId, "engineer", Boolean(boilerplate));
      const output = result.output as unknown as EngineerOutput;
      setBoilerplate(output);
      writeStartupCache(projectId, "engineer", output);
      setAiMode(result.mode);
      setAiFallbackReason(result.fallbackReason);
      logClientEvent(result.mode === "cache" ? "ai_employee_cache_hit" : "ai_employee_completed", projectId, { employee: "engineer", source: result.mode, duration_ms: Math.round(performance.now() - startedAt) });
    } catch {
      const activeWireframe = wireframe ?? generateWireframeMap(report);
      if (!wireframe) setWireframe(activeWireframe);
      const rawOutput = generateNextComponentBoilerplate(report, activeWireframe.steps[0]);
      const output = { ...rawOutput, componentName: cleanHeading(rawOutput.componentName, 64).replace(/\s+/g, "") };
      setBoilerplate(output);
      writeStartupCache(projectId, "engineer", output);
      setAiMode("mock");
      setAiFallbackReason("Server AI generation failed; local Engineer fallback was used.");
      logClientEvent("ai_employee_completed", projectId, { employee: "engineer", source: "mock", duration_ms: Math.round(performance.now() - startedAt) });
    } finally {
      setEngineerPending(false);
    }
  }

  return (
    <section id="startup-team" className="mt-8 overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <Sparkles className="size-4" />
            Startup Team
          </p>
          <h2 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight sm:text-4xl">Focused specialists for {projectTitle}.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Use one specialist at a time when you need a decision, launch plan, screen map, or build scope.
          </p>
        </div>
        <span className="rounded-full bg-cream px-4 py-2 text-xs font-black uppercase tracking-[.14em] text-ink/55">Explicit clicks only</span>
      </div>

      {personalizationReasons.length > 0 && (
        <details className="mt-5 rounded-2xl border border-violet/15 bg-violet/5 p-4 text-sm text-ink/65">
          <summary className="cursor-pointer font-black text-violet">Why specialist guidance may be personalized</summary>
          <ul className="mt-3 grid gap-2 leading-6">{personalizationReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
          <p className="mt-2 text-xs text-ink/45">Only this compact summary is eligible for an explicit AI request. Full project history is never sent.</p>
        </details>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {(aiMode || aiFallbackReason) && (
          <div className="rounded-2xl border border-moss/20 bg-lime/20 p-4 text-xs font-black uppercase tracking-[.14em] text-moss xl:col-span-3">
            {usageBadge(aiMode, aiFallbackReason)}
            {aiFallbackReason ? ` · ${aiFallbackReason}` : ""}
          </div>
        )}
        <article className="relative overflow-hidden rounded-[1.75rem] border border-violet/20 bg-gradient-to-br from-ink via-ink to-violet p-6 text-white shadow-glow xl:col-span-3">
          <div className="absolute -right-16 -top-16 size-44 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="flex min-w-0 gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-gold/40 bg-gold/15 text-gold shadow-sm">
                  <Crown className="size-8" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-gold">CEO AI</p>
                  <h3 className="mt-1 font-display text-3xl font-semibold">Strategic command</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{liveStatus}</p>
                  <div className="mt-4 grid gap-2 text-xs leading-5 text-white/70 md:grid-cols-3">
                    <DarkInfoPill label="Output" value="Strategic directive + top priority." />
                    <DarkInfoPill label="Use when" value="You need to know what to do next." />
                    <DarkInfoPill label="Est. time" value="~15-35 sec" />
                  </div>
                  {sprintTasks?.length ? <p className="mt-2 text-xs font-bold text-lime">Sprint memory loaded from Founder CRM.</p> : <p className="mt-2 text-xs font-bold text-white/45">No saved sprint tasks yet — CEO will use roadmap fallback.</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={consultCeo}
                disabled={ceoPending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-5 text-center text-sm font-black text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80 sm:shrink-0"
              >
                {ceoPending ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
                {ceoPending ? "CEO AI reviewing project context..." : "Consult CEO on roadmap"}
              </button>
            </div>

            {ceoPending && <LoadingPanel text="CEO AI reviewing project context..." />}

            {directive && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white p-5 text-ink">
                <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Strategic Directive</p>
                <h4 className="mt-2 font-display text-2xl font-semibold">{directive.priority}</h4>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-ink/65 md:grid-cols-2">
                  <DirectiveRow label="Phase" value={directive.phase} />
                  <DirectiveRow label="Top priority task" value={directive.selectedTask} />
                  <DirectiveRow label="CEO rationale" value={directive.rationale} />
                  <DirectiveRow label="Founder warning" value={directive.founderWarning} />
                  <DirectiveRow label="Next check-in" value={directive.nextCheckIn} />
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.75rem] border border-gold/20 bg-gradient-to-br from-white to-gold/20 p-5 shadow-sm">
          <div className="absolute -right-12 -top-12 size-32 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <EmployeeHeader icon={<Megaphone className="size-6" />} role="Marketer AI" status="Status: Preparing launch angles..." />
            <EmployeeDetails
              description="Turns the project into a practical launch plan."
              expectedOutput="Positioning, launch channels, copy, and first 100 users plan."
              useCase="Use when you need traffic and tester conversations."
              eta="~20-45 sec"
            />
            <button
              type="button"
              onClick={generateMarketingPlan}
              disabled={marketerPending}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-center text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 hover:bg-gold hover:text-ink hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
            >
              {marketerPending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              {marketerPending ? "Marketer AI building launch map..." : "Generate go-to-market plan"}
            </button>
            {marketerPending && <MiniLoadingPanel text="Marketer AI building launch map..." />}
            {gtmPlan && <GtmPlanOutputPanel output={gtmPlan} />}
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.75rem] border border-violet/15 bg-gradient-to-br from-white to-violet/10 p-5 shadow-sm">
          <div className="absolute -right-12 -top-12 size-32 rounded-full bg-violet/10 blur-3xl" />
          <div className="relative">
            <EmployeeHeader icon={<Palette className="size-6" />} role="Designer AI" status="Status: Wireframing user flows..." />
            <EmployeeDetails
              description="Maps your MVP idea into simple product screens."
              expectedOutput="3-step wireframe/component structure."
              useCase="Use before building UI so the product feels focused."
              eta="~15-35 sec"
            />
            <button
              type="button"
              onClick={requestWireframe}
              disabled={designerPending}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 hover:bg-violet hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
            >
              {designerPending ? <Loader2 className="size-4 animate-spin" /> : <Palette className="size-4" />}
              {designerPending ? "Designer AI mapping product screens..." : "Request UI/UX wireframe"}
            </button>
            {designerPending && <MiniLoadingPanel text="Designer AI mapping product screens..." />}
            {wireframe && <WireframeOutputPanel output={wireframe} />}
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.75rem] border border-moss/15 bg-gradient-to-br from-white to-lime/20 p-5 shadow-sm">
          <div className="absolute -right-12 -top-12 size-32 rounded-full bg-moss/10 blur-3xl" />
          <div className="relative">
            <EmployeeHeader icon={<Code2 className="size-6" />} role="MVP Builder" status="Status: Scoping the smallest useful build..." />
            <EmployeeDetails
              description="Turns the wireframe into a buildable first component without expanding scope."
              expectedOutput="Smallest component to build next, plus starter code."
              useCase="Use after Designer AI or when you need to decide what to build first."
              eta="~15-35 sec"
            />
            <button
              type="button"
              onClick={generateBoilerplate}
              disabled={engineerPending}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 hover:bg-moss hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80"
            >
              {engineerPending ? <Loader2 className="size-4 animate-spin" /> : <Code2 className="size-4" />}
              {engineerPending ? "MVP Builder assembling component code..." : "Plan smallest MVP component"}
            </button>
            {engineerPending && <MiniLoadingPanel text="MVP Builder assembling component code..." />}
            {boilerplate && <CodeOutputPanel output={boilerplate} />}
          </div>
        </article>
      </div>
    </section>
  );
}

function generateGtmPlan(projectTitle: string, status: ProjectStatus, report: OpportunityReport): GtmPlan {
  const reportSafe = safeReportParts(report);
  const mainBenefit = reportSafe.subheadline || reportSafe.oneSentenceIdea;
  const positioningStatement = `For ${reportSafe.targetCustomer} who struggle with ${reportSafe.painPoint}, ${projectTitle} helps them ${lowercaseFirst(mainBenefit)}.`;
  const channels = selectLaunchChannels(reportSafe, status);
  const roadmapSteps = reportSafe.first100UsersPlan.slice(0, 3);
  const first100UsersPlan = [
    `Create a one-page waitlist using the headline: "${reportSafe.heroHeadline}".`,
    `Message 20 ${reportSafe.targetCustomer} and ask for a 10-minute problem interview.`,
    ...roadmapSteps,
    `Post one proof-driven update every day using the top launch channel: ${channels[0].name}.`,
    `Track every reply, objection, signup, and referral in one simple launch spreadsheet.`,
  ].slice(0, 5);
  const launchPost = `I'm building ${projectTitle} for ${reportSafe.targetCustomer} who are tired of ${reportSafe.painPoint}. The goal is simple: ${mainBenefit}.\n\nIf this sounds like you, reply "launch" and I'll send early access.`;
  const videoHooks = [
    ...reportSafe.shortFormHooks,
    `If you are ${reportSafe.targetCustomer}, this mistake is probably costing you time.`,
    `I found a faster way to deal with ${reportSafe.painPoint}.`,
    `Building ${projectTitle} in public: here is the problem nobody is fixing.`,
  ].slice(0, 3);
  const coldMessages = [
    `Hey — quick question. Do you currently struggle with ${reportSafe.painPoint}? I'm testing ${projectTitle} for ${reportSafe.targetCustomer} and would love your honest take.`,
    `I'm interviewing ${reportSafe.targetCustomer} about ${reportSafe.painPoint}. Could I ask you 2 quick questions? No pitch — just research.`,
    `Saw you might care about this space. I'm building ${projectTitle} to help ${reportSafe.targetCustomer} ${lowercaseFirst(mainBenefit)}. Want early access when it's ready?`,
  ];

  return {
    positioningStatement,
    channels,
    first100UsersPlan,
    launchPost,
    videoHooks,
    coldMessages,
    riskWarning: riskWarningForStatus(status),
  };
}

function selectLaunchChannels(reportSafe: ReturnType<typeof safeReportParts>, status: ProjectStatus): GtmChannel[] {
  const channelPriorityByType: Record<string, string[]> = {
    ai_tool: ["TikTok/Reels/Shorts", "X/Twitter", "Product Hunt", "cold email/DM"],
    saas: ["LinkedIn", "Product Hunt", "cold email/DM", "X/Twitter"],
    digital_product: ["TikTok/Reels/Shorts", "SEO blog posts", "Reddit", "school/startup communities"],
    local_service: ["LinkedIn", "cold email/DM", "school/startup communities", "Reddit"],
    content_business: ["TikTok/Reels/Shorts", "Reddit", "SEO blog posts", "niche Discords"],
    e_commerce: ["TikTok/Reels/Shorts", "niche Discords", "Reddit", "cold email/DM"],
  };
  const statusBoost = status === "launched" ? ["Product Hunt", "SEO blog posts"] : status === "idea" ? ["cold email/DM", "Reddit"] : [];
  const preferred = uniqueStrings([...(channelPriorityByType[reportSafe.businessType] ?? []), ...statusBoost]);
  return preferred.slice(0, 3).map((channelName) => ({
    name: channelName,
    why: whyChannelFits(channelName, reportSafe, status),
    firstAction: firstChannelAction(channelName, reportSafe),
  }));
}

function whyChannelFits(channelName: string, reportSafe: ReturnType<typeof safeReportParts>, status: ProjectStatus) {
  if (channelName === "TikTok/Reels/Shorts") return `Short hooks can dramatize the pain point quickly, especially: "${reportSafe.shortFormHooks[0] ?? reportSafe.shockValueAngle}".`;
  if (channelName === "Reddit") return `${reportSafe.targetCustomer} likely discuss painful workflows in niche threads, making this useful for validation before polished launch.`;
  if (channelName === "X/Twitter") return `Founder/building-in-public posts fit ${reportSafe.businessTypeLabel} launches and make it easy to collect fast replies.`;
  if (channelName === "LinkedIn") return `The buyer or user can be reached through role-based search, which fits a ${status} project needing direct conversations.`;
  if (channelName === "SEO blog posts") return `Search content can compound around the exact problem: ${reportSafe.painPoint}.`;
  if (channelName === "cold email/DM") return `Direct outreach is the fastest path to learning whether ${reportSafe.targetCustomer} feel this problem urgently.`;
  if (channelName === "Product Hunt") return `A clean launch can turn the MVP into public proof and early feedback once the landing page is ready.`;
  if (channelName === "school/startup communities") return `Communities are great for quick feedback loops and early adopters willing to try unfinished tools.`;
  return `Niche communities help find dense groups of users already talking about ${reportSafe.painPoint}.`;
}

function firstChannelAction(channelName: string, reportSafe: ReturnType<typeof safeReportParts>) {
  if (channelName === "TikTok/Reels/Shorts") return `Record one 20-second clip using this hook: "${reportSafe.shortFormHooks[0] ?? reportSafe.shockValueAngle}".`;
  if (channelName === "Reddit") return `Find 3 relevant subreddits and post a question about ${reportSafe.painPoint}, not a product pitch.`;
  if (channelName === "X/Twitter") return `Post a build-in-public thread with the problem, the target user, and the first MVP screenshot/mockup.`;
  if (channelName === "LinkedIn") return `Search for 30 people matching ${reportSafe.targetCustomer} and send the first research DM.`;
  if (channelName === "SEO blog posts") return `Publish one practical article answering how to solve ${reportSafe.painPoint} manually.`;
  if (channelName === "cold email/DM") return `Send 20 research messages asking for feedback on the pain, not asking them to buy.`;
  if (channelName === "Product Hunt") return `Draft a maker comment around the pain point and collect 10 friendly testers first.`;
  if (channelName === "school/startup communities") return `Share the landing page in one trusted community and ask what would make them try it this week.`;
  return `Join 3 niche Discords and ask a specific question about the workflow you are improving.`;
}

function riskWarningForStatus(status: ProjectStatus) {
  const warnings: Record<ProjectStatus, string> = {
    idea: "Do not overbuild before validation.",
    validating: "Do not hide behind planning; talk to users.",
    building: "Do not add more features before launching the MVP.",
    launched: "Do not ignore retention and feedback loops.",
  };
  return warnings[status];
}

function generateWireframeMap(report: OpportunityReport): WireframeOutput {
  const reportSafe = safeReportParts(report);
  const primaryFeature = reportSafe.mustHaveFeatures[0] ?? reportSafe.featureList[0] ?? "Core workflow";
  const secondaryFeature = reportSafe.mustHaveFeatures[1] ?? reportSafe.featureList[1] ?? "Results view";
  const actionFeature = reportSafe.mustHaveFeatures[2] ?? reportSafe.featureList[2] ?? "Next action flow";
  const steps: WireframeStep[] = [
    {
      component: `Component 1: Hero Section with Input Box`,
      purpose: `Capture the first high-intent action from ${reportSafe.targetCustomer}.`,
      structure: [
        `Headline: ${reportSafe.heroHeadline}`,
        `Input box for the user's main problem or goal`,
        `Primary CTA: ${reportSafe.cta}`,
      ],
    },
    {
      component: `Component 2: Reactive Grid List`,
      purpose: `Show progress around ${primaryFeature} and ${secondaryFeature}.`,
      structure: [
        `Three-card grid for recommended next steps`,
        `Score/status badge on each card`,
        `Empty state that explains what the user should do next`,
      ],
    },
    {
      component: `Component 3: Action Drawer`,
      purpose: `Turn insight into execution without overwhelming the user.`,
      structure: [
        `Slide-over drawer for ${actionFeature}`,
        `Checklist pulled from the MVP plan`,
        `Sticky save/continue button at the bottom`,
      ],
    },
  ];
  return { steps, markdown: wireframeMarkdown(reportSafe.title, steps) };
}

function generateNextComponentBoilerplate(report: OpportunityReport, step: WireframeStep): EngineerOutput {
  const componentName = componentNameFromStep(step.component);
  const reportSafe = safeReportParts(report);
  return {
    componentName,
    code: `type ${componentName}Props = {
  projectTitle: string;
  primaryCta?: string;
};

export function ${componentName}({
  projectTitle,
  primaryCta = "${escapeForCode(reportSafe.cta)}",
}: ${componentName}Props) {
  const cards = [
    "${escapeForCode(reportSafe.mustHaveFeatures[0] ?? "Validate the core workflow")}",
    "${escapeForCode(reportSafe.mustHaveFeatures[1] ?? "Show the strongest next step")}",
    "${escapeForCode(reportSafe.mustHaveFeatures[2] ?? "Capture user intent")}",
  ];

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet">
            MVP Component
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            {projectTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
            ${escapeForCode(reportSafe.oneSentenceIdea)}
          </p>
        </div>
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-moss">
          {primaryCta}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <article key={card} className="rounded-2xl border border-ink/10 bg-cream/60 p-4">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet">
              Step {index + 1}
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">{card}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/55">
              Replace this with real project data once the MVP backend is connected.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}`,
  };
}

function wireframeMarkdown(title: string, steps: WireframeStep[]) {
  return [
    `# UI/UX Wireframe Map: ${title}`,
    "",
    ...steps.flatMap((step) => [
      `## ${step.component}`,
      `**Purpose:** ${step.purpose}`,
      "",
      ...step.structure.map((item) => `- ${item}`),
      "",
    ]),
  ].join("\n").trim();
}

function safeReportParts(report: OpportunityReport) {
  const businessType = safeString(report.input?.businessType, "saas");
  return {
    title: safeString(report.summary?.title, "Untitled project"),
    businessType,
    businessTypeLabel: businessTypeLabel(businessType),
    targetCustomer: safeString(report.summary?.targetCustomer, "your target customer"),
    painPoint: safeString(report.summary?.painPoint, "the core problem"),
    oneSentenceIdea: safeString(report.summary?.oneSentenceIdea, "A focused MVP built around the user's highest-value workflow."),
    heroHeadline: safeString(report.landingPageCopy?.heroHeadline, "Turn your idea into a focused MVP"),
    subheadline: safeString(report.landingPageCopy?.subheadline, ""),
    cta: safeString(report.landingPageCopy?.cta, "Start building"),
    mustHaveFeatures: safeStringArray(report.mvpPlan?.mustHaveFeatures),
    featureList: safeStringArray(report.mvpPlan?.featureList),
    shortFormHooks: safeStringArray(report.contentPlan?.shortFormHooks),
    shockValueAngle: safeString(report.contentPlan?.shockValueAngle, "the problem is more expensive than people realize"),
    first100UsersPlan: safeStringArray(report.executionRoadmap?.first100UsersPlan),
  };
}

function businessTypeLabel(value: string) {
  const labels: Record<string, string> = {
    saas: "SaaS",
    ai_tool: "AI tool",
    digital_product: "digital product",
    local_service: "local service",
    content_business: "content business",
    e_commerce: "e-commerce brand",
  };
  return labels[value] ?? "startup";
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => value.trim().length > 0 && array.indexOf(value) === index);
}

function lowercaseFirst(value: string) {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function componentNameFromStep(step: string) {
  if (step.includes("Hero")) return "MvpHeroInputSection";
  if (step.includes("Grid")) return "ReactiveMvpGrid";
  if (step.includes("Drawer")) return "ActionDrawer";
  return "GeneratedMvpComponent";
}

function escapeForCode(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function DirectiveRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function EmployeeHeader({ icon, role, status }: { icon: React.ReactNode; role: string; status: string }) {
  return (
    <div className="flex min-w-0 gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-violet shadow-sm">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[.16em] text-violet">{role}</p>
        <p className="mt-1 text-sm font-semibold text-ink/65">{status}</p>
      </div>
    </div>
  );
}

function EmployeeDetails({
  description,
  expectedOutput,
  useCase,
  eta,
}: {
  description: string;
  expectedOutput: string;
  useCase: string;
  eta: string;
}) {
  return (
    <div className="mt-4 grid gap-2 text-xs leading-5 text-ink/65">
      <p>{description}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <LightInfoPill label="Output" value={expectedOutput} />
        <LightInfoPill label="Use when" value={useCase} />
        <LightInfoPill label="Est. time" value={eta} />
      </div>
    </div>
  );
}

function LightInfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
      <p className="font-black uppercase tracking-[.14em] text-violet">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function DarkInfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
      <p className="font-black uppercase tracking-[.14em] text-gold">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function WireframeOutputPanel({ output }: { output: WireframeOutput }) {
  return (
    <div className="mt-5 min-w-0 rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[.14em] text-violet">Markdown layout map</p>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-ink p-4 text-xs leading-6 text-white/80">{output.markdown}</pre>
      <div className="mt-4 grid gap-3">
        {output.steps.map((step) => (
          <div key={step.component} className="rounded-2xl bg-cream/70 p-4">
            <p className="font-bold">{step.component}</p>
            <p className="mt-1 text-sm leading-6 text-ink/60">{step.purpose}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GtmPlanOutputPanel({ output }: { output: GtmPlan }) {
  return (
    <div className="mt-5 min-w-0 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.14em] text-violet">Go-to-market plan</p>
          <h4 className="mt-2 font-display text-2xl font-semibold">Launch angle locked</h4>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-cream/70 p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">Positioning statement</p>
        <p className="mt-2 text-sm leading-6 text-ink/70">{output.positioningStatement}</p>
      </div>

      <div className="mt-4 grid gap-3">
        <p className="text-xs font-black uppercase tracking-[.14em] text-violet">Launch channel priority</p>
        {output.channels.map((channel) => (
          <div key={channel.name} className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="font-bold">{channel.name}</p>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              <span className="font-bold text-ink/75">Why: </span>
              {channel.why}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              <span className="font-bold text-ink/75">First action: </span>
              {channel.firstAction}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-lime/25 p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-moss">First 100 users plan</p>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-ink/65">
          {output.first100UsersPlan.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>

      <div className="mt-4 grid gap-3">
        <CopyBlock title="Short launch post" text={output.launchPost} />
        <CopyListBlock title="Short-form video hooks" items={output.videoHooks} />
        <CopyListBlock title="Cold DM openers" items={output.coldMessages} />
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-amber-700">Risk warning</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">{output.riskWarning}</p>
      </div>
    </div>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-ink/10 bg-ink p-4 text-white">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs font-black uppercase tracking-[.14em] text-gold">{title}</p>
        <CopyTextButton text={text} />
      </div>
      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-white/5 p-3 text-xs leading-6 text-white/80">{text}</pre>
    </div>
  );
}

function CopyListBlock({ title, items }: { title: string; items: string[] }) {
  const text = items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return (
    <div className="min-w-0 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs font-black uppercase tracking-[.14em] text-violet">{title}</p>
        <CopyTextButton text={text} tone="light" />
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink/65">
        {items.map((item) => <li key={item} className="break-words">• {item}</li>)}
      </ul>
    </div>
  );
}

function CopyTextButton({ text, tone = "dark" }: { text: string; tone?: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        const didCopy = await copyTextToClipboard(text);
        setCopied(didCopy);
        setCopyFailed(!didCopy);
        if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          setCopyFailed(false);
        }, 1400);
      }}
      className={tone === "dark"
        ? "inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-ink sm:shrink-0"
        : "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-violet sm:shrink-0"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copyFailed ? "Copy failed" : copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeOutputPanel({ output }: { output: EngineerOutput }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-ink/10 bg-ink text-white">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.14em] text-gold">Next.js / Tailwind boilerplate</p>
          <p className="mt-1 break-words text-sm text-white/55">{output.componentName}.tsx</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const didCopy = await copyTextToClipboard(output.code);
            setCopied(didCopy);
            setCopyFailed(!didCopy);
            if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = window.setTimeout(() => {
              setCopied(false);
              setCopyFailed(false);
            }, 1400);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-ink sm:shrink-0"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copyFailed ? "Copy failed" : copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 max-w-full overflow-auto p-4 text-xs leading-6 text-white/80"><code>{output.code}</code></pre>
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea copy path below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);
    return didCopy;
  } catch {
    return false;
  }
}

function confirmRegenerate() {
  return window.confirm("Regenerating uses AI credits. Continue?");
}

function usageBadge(mode: "openai" | "mock" | "cache" | null, fallbackReason?: string | null) {
  const reason = fallbackReason?.toLowerCase() ?? "";
  if (reason.includes("cooldown active")) return "Cooldown active";
  if (reason.includes("limit reached") || reason.includes("usage limit")) return "Limit reached";
  if (mode === "openai") return "Generated with OpenAI";
  if (mode === "cache") return "Cached result";
  return "Local fallback";
}

function startupCacheKey(projectId: string, employee: "ceo" | "marketer" | "designer" | "engineer") {
  return `prismforge_startup_team_${projectId}_${employee}_v1`;
}

function readStartupCache<T>(projectId: string, employee: "ceo" | "marketer" | "designer" | "engineer") {
  const raw = window.localStorage.getItem(startupCacheKey(projectId, employee));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { output?: T };
  return parsed.output ?? null;
}

function writeStartupCache<T>(projectId: string, employee: "ceo" | "marketer" | "designer" | "engineer", output: T) {
  try {
    window.localStorage.setItem(startupCacheKey(projectId, employee), JSON.stringify({ output, savedAt: new Date().toISOString() }));
  } catch {
    // Local cache is best-effort only.
  }
}

function logClientEvent(
  eventName: "ai_employee_opened" | "ai_employee_started" | "ai_employee_completed" | "ai_employee_cache_hit",
  projectId: string,
  metadata: Record<string, string | boolean | number>,
) {
  try {
    void fetch("/api/beta-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, metadata: { ...metadata, project_id: projectId } }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the user action.
  }
}

function LoadingPanel({ text }: { text: string }) {
  return <div aria-live="polite" className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-semibold text-white/75">{text} One click = one generation.</div>;
}

function MiniLoadingPanel({ text }: { text: string }) {
  return <div aria-live="polite" className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-3 text-sm font-semibold text-ink/60">{text} One click = one generation.</div>;
}

