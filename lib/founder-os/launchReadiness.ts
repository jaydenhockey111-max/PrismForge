import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import { BUSINESS_TYPE_LABELS } from "@/lib/founder-os/helpers";
import { getNextBestAction } from "@/lib/founder-os/projectAlpha";
import { createProjectContext } from "@/lib/founder-os/projectContext";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";
import { cleanGeneratedCopy, cleanGeneratedList, cleanGeneratedMarkdown } from "@/lib/founder-os/copyQuality";
import type { ValidationBlocker } from "@/lib/founder-os/validationReadiness";

export type LaunchChecklistItem = {
  id: string;
  label: string;
};

export type LaunchChecklistGroup = {
  title: string;
  items: LaunchChecklistItem[];
};

export type LaunchReadinessInput = {
  title: string;
  status: ProjectStatus;
  score?: number | null;
  businessType: BusinessType;
  targetCustomer: string;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
  validationProof?: ProofSummary;
  validationBlockers?: ValidationBlocker[];
};

export type LaunchReadiness = {
  score: number;
  label: "Not Ready" | "Almost Ready" | "Alpha Ready";
  verdict: "Do not launch yet" | "Launch to close friends only" | "Ready for private alpha";
  explanation: string;
  blockers: string[];
  blockerDetails: ValidationBlocker[];
  completedCount: number;
  totalCount: number;
  firstChannel: string;
  testerInvite: string;
  launchPlan: string;
};

export const LAUNCH_CHECKLIST_GROUPS: LaunchChecklistGroup[] = [
  {
    title: "Validation",
    items: [
      { id: "target_customer", label: "Identify target audience" },
      { id: "pain_point", label: "Write the problem clearly" },
      { id: "talk_to_users", label: "Talk to 5 real people" },
      { id: "competitor_weakness", label: "Find 1 alternative or workaround" },
    ],
  },
  {
    title: "First version",
    items: [
      { id: "core_flow", label: "Pick one core workflow" },
      { id: "simple_version", label: "Create the simplest version" },
      { id: "mobile_test", label: "Test on mobile" },
      { id: "no_major_crashes", label: "Confirm no major crashes" },
    ],
  },
  {
    title: "Distribution",
    items: [
      { id: "launch_post", label: "Write first test post/message" },
      { id: "first_channel", label: "Pick first channel" },
      { id: "short_hooks", label: "Prepare 3 hooks/messages" },
      { id: "feedback_form", label: "Prepare feedback form" },
    ],
  },
  {
    title: "Alpha",
    items: [
      { id: "invite_testers", label: "Invite 10 testers or prospects" },
      { id: "collect_feedback", label: "Collect feedback" },
      { id: "fix_blockers", label: "Fix blocking issues" },
      { id: "decide_next", label: "Decide what to improve next" },
    ],
  },
];

export function calculateLaunchReadiness(input: LaunchReadinessInput, checkedItems: Record<string, boolean>): LaunchReadiness {
  const context = createProjectContext({ report: input.report, status: input.status, proof: input.validationProof });
  const fieldChecks = [
    hasAnyText(input.report.mvpPlan?.mustHaveFeatures) || hasAnyText(input.report.mvpPlan?.featureList),
    hasText(input.targetCustomer) || hasText(input.report.summary?.targetCustomer),
    hasText(input.report.summary?.painPoint),
    hasAnyText(input.report.monetizationPlan?.premiumTier) || hasText(input.report.monetizationPlan?.suggestedPrice),
    hasText(input.report.landingPageCopy?.heroHeadline) && hasText(input.report.landingPageCopy?.cta),
    hasAnyText(input.report.contentPlan?.shortFormHooks) || hasText(input.report.contentPlan?.shockValueAngle),
    hasAnyText(input.report.executionRoadmap?.today) || hasAnyText(input.report.executionRoadmap?.thisWeek),
    input.status === "building" || input.status === "launched",
    Boolean(input.validationProof && (input.validationProof.people_contacted >= 5 || input.validationProof.confidence_score >= 20)),
  ];
  const fieldScore = Math.round((fieldChecks.filter(Boolean).length / fieldChecks.length) * 55);
  const allItems = LAUNCH_CHECKLIST_GROUPS.flatMap((group) => group.items);
  const completedCount = allItems.filter((item) => checkedItems[item.id]).length;
  const checklistScore = Math.round((completedCount / allItems.length) * 45);
  const score = Math.min(100, fieldScore + checklistScore);
  const label = score <= 39 ? "Not Ready" : score <= 69 ? "Almost Ready" : "Alpha Ready";
  const verdict = score <= 39 ? "Do not launch yet" : score <= 69 ? "Launch to close friends only" : "Ready for private alpha";
  const blockers = launchBlockers(input, checkedItems);
  const blockerDetails = (input.validationBlockers ?? []).slice(0, 3);
  const firstChannel = suggestedFirstChannel(input);
  const testerInvite = createTesterInvite(input);
  const explanation = verdictExplanation(score, input.status, context.language.releaseNoun);

  return {
    score,
    label,
    verdict,
    explanation,
    blockers: cleanGeneratedList(blockers),
    blockerDetails,
    completedCount,
    totalCount: allItems.length,
    firstChannel: cleanGeneratedCopy(firstChannel),
    testerInvite: cleanGeneratedCopy(testerInvite),
    launchPlan: cleanGeneratedMarkdown(createLaunchPlan({ input, score, verdict, blockers, completedCount, totalCount: allItems.length, firstChannel, testerInvite })),
  };
}

function launchBlockers(input: LaunchReadinessInput, checkedItems: Record<string, boolean>) {
  if (input.validationBlockers?.length) return input.validationBlockers.map((blocker) => blocker.label).slice(0, 3);
  const context = createProjectContext({ report: input.report, status: input.status, proof: input.validationProof });
  const blockers: string[] = [];
  if (!hasText(input.targetCustomer) && !hasText(input.report.summary?.targetCustomer)) blockers.push("Target audience is unclear.");
  if (!hasText(input.report.summary?.painPoint)) blockers.push("Problem is unclear.");
  if (!hasAnyText(input.report.mvpPlan?.mustHaveFeatures) && !hasAnyText(input.report.mvpPlan?.featureList)) blockers.push(`${context.language.productNoun} plan is missing.`);
  if (!input.validationProof || input.validationProof.people_contacted < 5) blockers.push(`You have not logged enough evidence from ${context.language.userNoun} yet.`);
  if (!hasAnyText(input.report.contentPlan?.shortFormHooks) && !hasText(input.report.contentPlan?.shockValueAngle)) blockers.push(`No first ${context.language.releaseNoun} channel or message is selected.`);
  if (!checkedItems.mobile_test) blockers.push("You have not marked mobile testing complete.");
  if (!checkedItems.invite_testers) blockers.push(`You have not invited ${context.language.userNoun} yet.`);
  if (!checkedItems.feedback_form) blockers.push("Beta feedback form is not prepared.");

  return (blockers.length ? blockers : context.recommendedBlockers).slice(0, 3);
}

function createLaunchPlan({
  input,
  score,
  verdict,
  blockers,
  completedCount,
  totalCount,
  firstChannel,
  testerInvite,
}: {
  input: LaunchReadinessInput;
  score: number;
  verdict: string;
  blockers: string[];
  completedCount: number;
  totalCount: number;
  firstChannel: string;
  testerInvite: string;
}) {
  const context = createProjectContext({ report: input.report, status: input.status, proof: input.validationProof });
  return [
    "PrismForge Launch Plan",
    "",
    `Project: ${input.title}`,
    `Project type: ${context.projectType}`,
    `Solution category: ${context.solutionCategory}`,
    `Release type: ${context.language.releaseNoun}`,
    `Launch readiness: ${score}/100`,
    `Verdict: ${verdict}`,
    `Checklist: ${completedCount}/${totalCount} complete`,
    `Business type: ${BUSINESS_TYPE_LABELS[input.businessType] ?? input.businessType}`,
    `Validation proof: ${input.validationProof ? `${input.validationProof.confidence_score}/100 from ${input.validationProof.experiment_count} experiment(s)` : "Not logged yet"}`,
    "",
    "Top blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- Looks alpha-ready. Your next move is inviting testers."]),
    "",
    `Next best action: ${getNextBestAction(input.status, input.sprintTasks)}`,
    `Suggested first channel: ${firstChannel}`,
    "",
    "Tester invite message:",
    testerInvite,
  ].join("\n");
}

function createTesterInvite(input: LaunchReadinessInput) {
  const context = createProjectContext({ report: input.report, status: input.status, proof: input.validationProof });
  return `Hey — I’m testing an early ${context.language.releaseNoun} for ${context.title}. It helps ${context.audience} with ${context.problem}. I’d love for you to try it and tell me what’s confusing, useful, or broken.`;
}

function suggestedFirstChannel(input: LaunchReadinessInput) {
  const context = createProjectContext({ report: input.report, status: input.status, proof: input.validationProof });
  const hook = firstText(input.report.contentPlan?.shortFormHooks);
  if (hook) return `TikTok/Reels/Shorts — ${hook}`;
  if (context.projectType === "Education Tool") return "school communities or student group chats";
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") return "cold email/DM";
  if (context.projectType === "Course" || context.projectType === "Coaching") return "pilot learner outreach";
  if (context.projectType === "Community") return "niche Discords or group chats";
  if (input.businessType === "saas" || input.businessType === "ai_tool") return "LinkedIn or X/Twitter build-in-public post";
  if (input.businessType === "content_business" || input.businessType === "digital_product") return "TikTok/Reels/Shorts";
  if (input.businessType === "local_service") return "cold email/DM";
  return input.report.contentPlan?.shockValueAngle || "Reddit or niche Discords";
}

function verdictExplanation(score: number, status: ProjectStatus, releaseNoun: string) {
  if (score < 40) return `The project is still in ${status} mode and needs clearer validation/first-version basics before inviting testers.`;
  if (score < 70) return `The core is forming, but keep the first ${releaseNoun} small and use close friends or trusted testers only.`;
  return `The essentials are in place. Invite a small private-alpha group and learn from real feedback.`;
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
