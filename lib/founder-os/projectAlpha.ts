import type { BusinessType, OpportunityReport, ProjectStatus } from "./types";
import type { SprintTaskOutput } from "./executionTools";
import { BUSINESS_TYPE_LABELS } from "./helpers";
import type { ProofSummary } from "../proof-board";
import { selectValidationPath, type ValidationRoutingResult } from "./validationReadiness";
import { createProjectContext, validationActionForContext } from "./projectContext";
import { cleanGeneratedMarkdown } from "./copyQuality";

export type ProjectHealth = {
  score: number;
  label: "Needs Setup" | "Alpha Ready" | "Strong Signal";
  missingItems: string[];
};

export type ProjectBriefInput = {
  title: string;
  status: ProjectStatus;
  score?: number | null;
  businessType: BusinessType;
  targetCustomer: string;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
};

export type NextBestActionDetail = {
  action: string;
  why: string;
  estimatedTime: string;
  href: string;
  area: "Project" | "Proof Board" | "Outreach Kit" | "First Dollar Sprint" | "Launch Command Center" | "AI Team";
  doneWhen?: string;
  evidenceToRecord?: string;
  afterCompletion?: string;
};

export function completeNextBestActionDetail(detail: NextBestActionDetail): NextBestActionDetail & Required<Pick<NextBestActionDetail, "doneWhen" | "evidenceToRecord" | "afterCompletion">> {
  return {
    ...detail,
    doneWhen: detail.doneWhen ?? "The action is completed and the factual result is recorded in Proof Board.",
    evidenceToRecord: detail.evidenceToRecord ?? "What you tried, who or what responded, the result, and what remained unclear.",
    afterCompletion: detail.afterCompletion ?? "PrismForge will compare the saved result with the active assumption and update the next action when the evidence changes the path.",
  };
}

export function calculateProjectHealth(input: ProjectBriefInput): ProjectHealth {
  const checks = [
    { ok: hasText(input.title), missing: "Add a clear project title" },
    { ok: hasText(input.businessType), missing: "Choose a business type" },
    { ok: hasText(input.targetCustomer), missing: "Define the target customer" },
    { ok: hasAnyText(input.report.mvpPlan?.mustHaveFeatures) || hasAnyText(input.report.mvpPlan?.featureList), missing: "Add a sharper MVP plan" },
    { ok: hasAnyText(input.report.monetizationPlan?.premiumTier) || hasText(input.report.monetizationPlan?.suggestedPrice), missing: "Clarify monetization" },
    { ok: hasText(input.report.landingPageCopy?.heroHeadline) && hasText(input.report.landingPageCopy?.cta), missing: "Improve landing page copy" },
    { ok: hasAnyText(input.report.contentPlan?.shortFormHooks) || hasText(input.report.contentPlan?.shockValueAngle), missing: "Add content or launch hooks" },
    { ok: hasAnyText(input.report.executionRoadmap?.today) || hasAnyText(input.report.executionRoadmap?.thisWeek), missing: "Make the roadmap more actionable" },
    { ok: hasText(input.status), missing: "Set a project status" },
  ];
  const passed = checks.filter((check) => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const label = score <= 39 ? "Needs Setup" : score <= 69 ? "Alpha Ready" : "Strong Signal";
  const missingItems = checks.filter((check) => !check.ok).map((check) => check.missing).slice(0, 3);

  return {
    score,
    label,
    missingItems: missingItems.length ? missingItems : ["Open Startup Team and generate one useful output", "Copy a launch asset you can use today", "Send beta feedback after testing"],
  };
}

export function getNextBestAction(status: ProjectStatus, sprintTasks?: SprintTaskOutput[]) {
  const statusActions: Record<ProjectStatus, string> = {
    idea: "Validate the pain point with 5 real people.",
    validating: "Collect proof before building more features.",
    building: "Finish one MVP flow and launch to testers.",
    launched: "Review feedback and improve retention.",
  };
  const sprintTask = sprintTasks?.find((task) => hasText(task.task)) ?? sprintTasks?.[0];
  return sprintTask ? `${statusActions[status]} First sprint task: ${sprintTask.task}` : statusActions[status];
}

export function getNextBestActionDetail({
  status,
  sprintTasks,
  proof,
  report,
  validationPath,
}: {
  status: ProjectStatus;
  sprintTasks?: SprintTaskOutput[];
  proof?: ProofSummary;
  report?: OpportunityReport;
  validationPath?: ValidationRoutingResult;
}): NextBestActionDetail {
  if (validationPath && !validationPath.complete) {
    return {
      action: validationPath.firstAction.action,
      why: validationPath.firstAction.why,
      estimatedTime: validationPath.firstAction.estimatedTime,
      href: validationPath.firstAction.href,
      area: "Proof Board",
      doneWhen: validationPath.firstAction.doneWhen,
      evidenceToRecord: validationPath.firstAction.evidenceToRecord,
      afterCompletion: validationPath.firstAction.afterCompletion,
    };
  }
  const context = report ? createProjectContext({ report, status, proof }) : null;
  if (!proof || proof.experiment_count === 0) {
    if (report) {
      const path = selectValidationPath({ report, status, proof });
      return {
        action: path.action,
        why: path.why,
        estimatedTime: "20-30 minutes",
        href: path.href,
        area: path.href.includes("plan") ? "Project" : "Proof Board",
      };
    }
    return {
      action: "Create your first validation experiment before building more features.",
      why: "Without real-world proof, the report is still a smart guess. One small experiment turns guessing into evidence.",
      estimatedTime: "20-30 minutes",
      href: "?section=validate",
      area: "Proof Board",
    };
  }

  if (proof.people_contacted <= 0) {
    return {
      action: context ? validationActionForContext(context) : "Contact 10 people in your target audience and ask about the pain point.",
      why: context ? `A planned experiment only becomes useful after real ${context.language.userNoun} react to the problem.` : "A planned experiment only becomes useful after someone outside the app reacts to the problem.",
      estimatedTime: "30 minutes",
      href: "?section=validate",
      area: "Outreach Kit",
    };
  }

  if (proof.replies <= 0 || proof.replies / Math.max(1, proof.people_contacted) < 0.2) {
    return {
      action: "Improve your outreach message and contact 10 more people.",
      why: "Low replies usually means the audience, opening line, or pain point is not sharp enough yet.",
      estimatedTime: "25 minutes",
      href: "?section=validate",
      area: "Outreach Kit",
    };
  }

  if (proof.pain_confirmed <= 0 || proof.pain_confirmed / Math.max(1, proof.replies) < 0.35) {
    return {
      action: "Try a narrower audience or reword the problem, then log what changes.",
      why: "Replies are useful, but PrismForge needs proof that the pain is real enough to act on.",
      estimatedTime: "20 minutes",
      href: "?section=validate",
      area: "Proof Board",
    };
  }

  if (proof.interested_users <= 0) {
    return {
      action: context ? `Offer a small ${context.language.releaseNoun} invite and track who says yes.` : "Offer a beta or waitlist invite and track who says yes.",
      why: context ? `Pain is promising, but a real commitment shows whether ${context.language.userNoun} want this from you.` : "Pain is promising, but interest shows whether people want a solution from you.",
      estimatedTime: "20 minutes",
      href: "?section=launch",
      area: "First Dollar Sprint",
    };
  }

  if (proof.waitlist_signups <= 0) {
    return {
      action: context ? `Create a simple ${context.language.releaseNoun} signup and ask interested ${context.language.userNoun} to join.` : "Create a simple waitlist or beta signup and ask interested users to join.",
      why: "A signup is stronger than a compliment because it asks users to make a small commitment.",
      estimatedTime: "30-45 minutes",
      href: "?section=launch",
      area: "First Dollar Sprint",
    };
  }

  if (proof.payment_intent <= 0 && proof.preorders_or_revenue_cents <= 0) {
    return {
      action: "Test willingness to pay. Ask interested users if they would pay and at what price.",
      why: "Payment intent is the clearest early signal that this can move toward revenue.",
      estimatedTime: "20 minutes",
      href: "?section=launch",
      area: "First Dollar Sprint",
    };
  }

  if (proof.payment_intent > 0 || proof.preorders_or_revenue_cents > 0) {
    return {
      action: context ? `Payment evidence logged. Move toward a tiny paid ${context.language.releaseNoun} focused only on the core pain.` : "Strong signal. Move toward a tiny MVP or paid beta focused only on the core pain.",
      why: context ? `Someone showed willingness to pay. Now the danger is overbuilding instead of shipping the smallest useful ${context.language.productNoun}.` : "Someone showed willingness to pay. Now the danger is overbuilding instead of shipping the smallest useful version.",
      estimatedTime: "45-90 minutes",
      href: "?section=launch",
      area: "Launch Command Center",
    };
  }

  const sprintTask = sprintTasks?.find((task) => hasText(task.task)) ?? sprintTasks?.[0];
  return {
    action: sprintTask ? `${getNextBestAction(status)} First sprint task: ${sprintTask.task}` : getNextBestAction(status),
    why: "This keeps the project moving without adding features blindly.",
    estimatedTime: "20 minutes",
    href: "?section=ai-team",
    area: "AI Team",
  };
}

export function createProjectBrief(input: ProjectBriefInput) {
  const context = createProjectContext({ report: input.report, status: input.status });
  const nextAction = getNextBestAction(input.status, input.sprintTasks);
  const topMvpFeature = firstText(input.report.mvpPlan?.mustHaveFeatures) ?? firstText(input.report.mvpPlan?.featureList) ?? "Not available";
  const launchHook = firstText(input.report.contentPlan?.shortFormHooks) ?? input.report.contentPlan?.shockValueAngle ?? "Not available";
  const painPoint = input.report.summary?.painPoint ?? "Not available";

  return cleanGeneratedMarkdown([
    "PrismForge Project Brief",
    "",
    `Project: ${input.title}`,
    `Status: ${input.status}`,
    `Score: ${typeof input.score === "number" ? input.score : input.report.score?.overall ?? "Not available"}`,
    `Business type: ${BUSINESS_TYPE_LABELS[input.businessType] ?? input.businessType}`,
    `Project type: ${context.projectType}`,
    `Solution category: ${context.solutionCategory}`,
    `Target customer: ${input.targetCustomer || input.report.summary?.targetCustomer || "Not available"}`,
    `Pain point: ${painPoint}`,
    "",
    `Next best action: ${nextAction}`,
    `Top MVP feature: ${topMvpFeature}`,
    `Top launch hook/channel: ${launchHook}`,
  ].join("\n"));
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAnyText(value: unknown) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function firstText(value: unknown) {
  return Array.isArray(value) ? value.find((item): item is string => hasText(item)) : undefined;
}
