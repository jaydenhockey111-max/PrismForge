import type { OpportunityProject, ProjectOutput, ProjectValidationExperiment } from "@/lib/database.types";
import { cleanGeneratedCopy, sentence } from "@/lib/founder-os/copyQuality";
import { createProjectContext, validationActionForContext, type ProjectContext } from "@/lib/founder-os/projectContext";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";
import type { ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";
import type { FounderGuidancePreferences } from "@/lib/founder-intelligence/types";
import { weeklyQuestLimit } from "@/lib/founder-intelligence/engine";

export type QuestCadence = "daily" | "weekly";
export type QuestCategory = "clarify" | "validate" | "build" | "outreach" | "evidence" | "pricing" | "launch" | "decision" | "progress";
export type QuestVerificationMethod = "system_state" | "evidence_record" | "manual_with_detail" | "hybrid";
export type QuestSource = "next_best_action" | "project_stage" | "missing_fundamental" | "evidence_gap" | "milestone" | "launch_blocker";
export type QuestStatus = "active" | "completed" | "expired" | "replaced" | "skipped";

export type FounderQuest = {
  id: string;
  userId?: string;
  projectId: string;
  cadence: QuestCadence;
  category: QuestCategory;
  title: string;
  description: string;
  whyItMatters: string;
  completionRequirement: string;
  targetType: string;
  targetValue?: number;
  currentValue?: number;
  verificationMethod: QuestVerificationMethod;
  source: QuestSource;
  status: QuestStatus;
  generatedAt: string;
  startsAt: string;
  dueAt: string;
  completedAt?: string;
  href: string;
  primaryCta: string;
  estimatedTime: string;
  done: boolean;
  periodKey: string;
  metadata: {
    projectStatus?: ProjectStatus;
    projectType?: string;
    businessType?: BusinessType | string;
    nextBestAction?: string;
    evidenceAttached?: boolean;
    trustWeight: "high" | "medium" | "low";
  };
  alternatives?: Array<Pick<FounderQuest, "title" | "description" | "completionRequirement" | "targetValue" | "estimatedTime">>;
};

export type QuestPlan = {
  dailyQuest: FounderQuest | null;
  weeklyQuests: FounderQuest[];
  weeklyOutcome: string;
  weeklyCompleted: number;
  weeklyTotal: number;
  emptyState?: string;
};

export type QuestProject = Pick<OpportunityProject, "id" | "title" | "business_type" | "target_customer" | "status" | "report_json" | "created_at" | "updated_at"> & Partial<Pick<OpportunityProject, "lifecycle_status" | "deleted_at">>;

export type QuestInput = {
  userId?: string;
  project?: QuestProject | null;
  report?: OpportunityReport | null;
  proof?: ProofSummary | null;
  experiments?: ProjectValidationExperiment[];
  outputs?: ProjectOutput[];
  nextBestAction?: { action: string; why?: string; href?: string; estimatedTime?: string } | null;
  validationPath?: ValidationRoutingResult | null;
  now?: Date;
  timeZone?: string;
  guidancePreferences?: FounderGuidancePreferences;
};

const DEFAULT_TIME_ZONE = "America/New_York";

export function buildFounderQuestPlan(input: QuestInput): QuestPlan {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const dayWindow = localDayWindow(now, timeZone);
  const weekWindow = localWeekWindow(now, timeZone);

  if (!input.project || !input.report) {
    return {
      dailyQuest: null,
      weeklyQuests: [],
      weeklyOutcome: "Create or open a project to receive a focused daily action.",
      weeklyCompleted: 0,
      weeklyTotal: 0,
      emptyState: "Create or open a project to receive a focused daily action.",
    };
  }

  if (input.project.deleted_at || (input.project.lifecycle_status ?? "active") !== "active") {
    const label = input.project.deleted_at ? "in recovery" : input.project.lifecycle_status;
    return { dailyQuest: null, weeklyQuests: [], weeklyOutcome: `This project is ${label}. Resume or restore it before generating new routine quests.`, weeklyCompleted: 0, weeklyTotal: 0, emptyState: `This project is ${label}. Its completed quest history remains preserved.` };
  }

  const proof = input.proof ?? emptyProofSummary();
  const context = createProjectContext({ report: input.report, status: input.project.status, proof });
  const hrefBase = `/projects/${input.project.id}`;
  const nextAction = input.nextBestAction?.action || validationActionForContext(context);
  const dailyQuest = selectDailyQuest({
    input,
    context,
    proof,
    nextAction,
    hrefBase,
    generatedAt: now.toISOString(),
    startsAt: dayWindow.startsAt,
    dueAt: dayWindow.dueAt,
    periodKey: dayWindow.key,
  });
  const weeklyQuests = selectWeeklyQuests({
    input,
    context,
    proof,
    nextAction,
    hrefBase,
    generatedAt: now.toISOString(),
    startsAt: weekWindow.startsAt,
    dueAt: weekWindow.dueAt,
    periodKey: weekWindow.key,
    dailyQuest,
  });
  const adaptedWeeklyQuests = adaptWeeklyQuests(weeklyQuests, input.guidancePreferences);
  const adaptedDailyQuest = adaptQuestPresentation(dailyQuest, input.guidancePreferences);
  const weeklyCompleted = adaptedWeeklyQuests.filter((quest) => quest.done).length;

  return {
    dailyQuest: adaptedDailyQuest,
    weeklyQuests: adaptedWeeklyQuests,
    weeklyOutcome: weeklyOutcomeFor(context, proof),
    weeklyCompleted,
    weeklyTotal: adaptedWeeklyQuests.length,
  };
}

function selectDailyQuest({
  input,
  context,
  proof,
  nextAction,
  hrefBase,
  generatedAt,
  startsAt,
  dueAt,
  periodKey,
}: {
  input: QuestInput;
  context: ProjectContext;
  proof: ProofSummary;
  nextAction: string;
  hrefBase: string;
  generatedAt: string;
  startsAt: string;
  dueAt: string;
  periodKey: string;
}) {
  const missing = missingFundamentals(input.report!, context);
  const scope = dailyScope(context.founder.hoursPerWeek);
  const projectId = input.project!.id;
  const base = {
    userId: input.userId,
    projectId,
    cadence: "daily" as const,
    status: "active" as const,
    generatedAt,
    startsAt,
    dueAt,
    periodKey,
    metadata: metadata(input.project!, context, nextAction),
  };

  if (missing.length > 0) {
    const item = missing[0];
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "clarify", item.key),
      category: "clarify",
      title: item.title,
      description: item.description,
      whyItMatters: "A useful next action needs a clear audience, problem, and smallest version. This removes guessing before you spend time building.",
      completionRequirement: item.completionRequirement,
      targetType: item.key,
      verificationMethod: "system_state",
      source: "missing_fundamental",
      href: `${hrefBase}?section=project`,
      primaryCta: "Open project details",
      estimatedTime: scope.short,
      done: item.done,
    });
  }

  if (input.validationPath && !input.validationPath.complete) {
    const path = input.validationPath;
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "validate", path.pathType),
      category: path.pathType === "pricing_test" ? "pricing" : path.pathType === "launch_readiness" ? "launch" : path.pathType === "project_clarification" ? "clarify" : "validate",
      title: path.title,
      description: path.firstAction.action,
      whyItMatters: path.firstAction.why,
      completionRequirement: path.firstAction.doneWhen,
      targetType: `validation_path:${path.pathType}`,
      targetValue: 1,
      currentValue: path.complete ? 1 : 0,
      verificationMethod: path.targetEvidenceType === "other" ? "manual_with_detail" : "evidence_record",
      source: "next_best_action",
      href: `${hrefBase}${path.firstAction.href}`,
      primaryCta: "Work the active path",
      estimatedTime: path.firstAction.estimatedTime,
      done: path.complete,
      alternatives: path.alternatives.map((alternative) => ({ title: alternative.title, description: alternative.whyItMightFit, completionRequirement: `Record ${alternative.evidenceProduced}`, targetValue: 1, estimatedTime: scope.medium })),
    });
  }

  if (proof.people_contacted <= 0) {
    const title = context.founder.riskTolerance <= 3
      ? `Write five private questions for ${context.language.userNoun}`
      : `Write five interview questions for ${context.language.userNoun}`;
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "validate", "first-questions"),
      category: "validate",
      title,
      description: `Use the questions to learn how ${context.language.userNoun} currently deal with ${lower(context.problem)}.`,
      whyItMatters: `This turns the Next Best Action into a concrete first step: ${sentence(nextAction)}`,
      completionRequirement: "Write the questions, then paste them into a Proof Board experiment or use them in outreach.",
      targetType: "interview_questions_written",
      targetValue: 5,
      currentValue: 0,
      verificationMethod: "manual_with_detail",
      source: "next_best_action",
      href: `${hrefBase}?section=validate#proof-board`,
      primaryCta: "Open Proof Board",
      estimatedTime: scope.short,
      done: false,
      alternatives: [
        {
          title: `List five ${context.language.userNoun} to ask`,
          description: `Identify five reachable ${context.language.userNoun}; do not message them yet if that feels too soon.`,
          completionRequirement: "Write the list and your reason for choosing them.",
          targetValue: 5,
          estimatedTime: scope.tiny,
        },
      ],
    });
  }

  if (proof.people_contacted < firstContactTarget(context)) {
    const target = firstContactTarget(context);
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "outreach", "contact-target-users"),
      category: "outreach",
      title: `Contact ${Math.min(3, target - proof.people_contacted)} ${context.language.userNoun}`,
      description: `Ask about ${lower(context.problem)} in their own words. Keep it personal and short.`,
      whyItMatters: "The project cannot move from structure to proof until real people respond.",
      completionRequirement: "Log the outreach in Proof Board with people contacted and replies.",
      targetType: "people_contacted",
      targetValue: target,
      currentValue: proof.people_contacted,
      verificationMethod: "evidence_record",
      source: "evidence_gap",
      href: `${hrefBase}?section=validate#proof-board`,
      primaryCta: "Log evidence",
      estimatedTime: scope.medium,
      done: proof.people_contacted >= target,
    });
  }

  if (proof.replies <= 0) {
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "outreach", "improve-message"),
      category: "outreach",
      title: "Rewrite your outreach message around one painful moment",
      description: `Make the first line about a specific situation ${context.language.userNoun} recognize, not about your idea.`,
      whyItMatters: "Low or missing replies usually means the audience or opening line is too vague.",
      completionRequirement: "Save the revised message or log the next outreach attempt in Proof Board.",
      targetType: "outreach_revision",
      targetValue: 1,
      currentValue: 0,
      verificationMethod: "manual_with_detail",
      source: "next_best_action",
      href: `${hrefBase}?section=validate`,
      primaryCta: "Open outreach support",
      estimatedTime: scope.short,
      done: false,
    });
  }

  if (proof.pain_confirmed < 3) {
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "evidence", "record-repeated-pain"),
      category: "evidence",
      title: "Record one repeated problem you heard",
      description: `Look for the same pain showing up across ${context.language.userNoun}; write the pattern, not a perfect quote.`,
      whyItMatters: "Repeated pain is stronger than compliments and helps decide what to build next.",
      completionRequirement: "Update Proof Board with what was learned and the number of pain confirmations.",
      targetType: "pain_confirmed",
      targetValue: 3,
      currentValue: proof.pain_confirmed,
      verificationMethod: "evidence_record",
      source: "evidence_gap",
      href: `${hrefBase}?section=validate#proof-board`,
      primaryCta: "Update Proof Board",
      estimatedTime: scope.short,
      done: proof.pain_confirmed >= 3,
    });
  }

  if (input.project!.status === "building") {
    const buildNoun = context.language.productNoun;
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "build", "one-testable-flow"),
      category: "build",
      title: `Define the one ${buildNoun} flow to test first`,
      description: `Write the start, middle, and finish of the smallest version ${context.language.userNoun} can react to.`,
      whyItMatters: "Building is useful only when it creates something testable. This prevents endless feature work.",
      completionRequirement: "Write the three-step flow or mark the related sprint task complete outside PrismForge.",
      targetType: "testable_flow_defined",
      targetValue: 1,
      currentValue: hasOutput(input.outputs, "sprint_tasks") ? 1 : 0,
      verificationMethod: "hybrid",
      source: "project_stage",
      href: `${hrefBase}?section=ai-team`,
      primaryCta: "Open specialists",
      estimatedTime: scope.medium,
      done: false,
    });
  }

  if (proof.interested_users <= 0 && proof.waitlist_signups <= 0) {
    return quest({
      ...base,
      id: questId(projectId, "daily", periodKey, "launch", "ask-for-commitment"),
      category: "launch",
      title: `Ask one ${context.language.userNoun} for a small commitment`,
      description: `Offer a waitlist, beta invite, pilot, or next conversation. Do not treat compliments as proof.`,
      whyItMatters: "A small commitment is stronger than interest because it asks someone to take a step.",
      completionRequirement: "Log interested users or waitlist signups in Proof Board.",
      targetType: "commitment_signal",
      targetValue: 1,
      currentValue: proof.interested_users + proof.waitlist_signups,
      verificationMethod: "evidence_record",
      source: "milestone",
      href: `${hrefBase}?section=launch`,
      primaryCta: "Open launch tools",
      estimatedTime: scope.medium,
      done: proof.interested_users + proof.waitlist_signups > 0,
    });
  }

  return quest({
    ...base,
    id: questId(projectId, "daily", periodKey, "decision", "choose-next-decision"),
    category: "decision",
    title: "Write the next project decision",
    description: "Use your current evidence to decide whether to continue, narrow the audience, change the offer, or launch a tiny test.",
    whyItMatters: "Evidence only creates progress when it changes what you do next.",
    completionRequirement: "Write the decision and the evidence behind it.",
    targetType: "decision_recorded",
    targetValue: 1,
    currentValue: 0,
    verificationMethod: "manual_with_detail",
    source: "milestone",
    href: `${hrefBase}/value-proof`,
    primaryCta: "Open Value Proof",
    estimatedTime: scope.short,
    done: false,
  });
}

function selectWeeklyQuests({
  input,
  context,
  proof,
  nextAction,
  hrefBase,
  generatedAt,
  startsAt,
  dueAt,
  periodKey,
  dailyQuest,
}: {
  input: QuestInput;
  context: ProjectContext;
  proof: ProofSummary;
  nextAction: string;
  hrefBase: string;
  generatedAt: string;
  startsAt: string;
  dueAt: string;
  periodKey: string;
  dailyQuest: FounderQuest;
}) {
  const base = {
    userId: input.userId,
    projectId: input.project!.id,
    cadence: "weekly" as const,
    status: "active" as const,
    generatedAt,
    startsAt,
    dueAt,
    periodKey,
    metadata: metadata(input.project!, context, nextAction),
  };
  if (input.validationPath && !input.validationPath.complete) {
    const path = input.validationPath;
    const pathHref = `${hrefBase}?section=validate#proof-board`;
    return [
      quest({ ...base, id: questId(input.project!.id, "weekly", periodKey, "validate", `${path.pathType}-action`), category: path.pathType === "pricing_test" ? "pricing" : "validate", title: path.title, description: path.firstAction.action, whyItMatters: path.firstAction.why, completionRequirement: path.firstAction.doneWhen, targetType: `validation_path:${path.pathType}`, targetValue: 1, currentValue: path.progress >= 60 ? 1 : 0, verificationMethod: path.targetEvidenceType === "other" ? "manual_with_detail" : "evidence_record", source: "next_best_action", href: pathHref, primaryCta: "Work active path", estimatedTime: path.firstAction.estimatedTime, done: path.complete }),
      quest({ ...base, id: questId(input.project!.id, "weekly", periodKey, "evidence", `${path.pathType}-proof`), category: "evidence", title: `Record ${path.title.toLowerCase()} evidence`, description: path.firstAction.evidenceToRecord, whyItMatters: "Saved evidence keeps the next recommendation grounded in what actually happened.", completionRequirement: path.completionRequirement, targetType: `evidence_type:${path.targetEvidenceType}`, targetValue: 1, currentValue: path.progress > 0 ? 1 : 0, verificationMethod: "evidence_record", source: "evidence_gap", href: pathHref, primaryCta: "Record evidence", estimatedTime: "10-20 minutes", done: path.complete }),
      quest({ ...base, id: questId(input.project!.id, "weekly", periodKey, "decision", `${path.pathType}-decision`), category: "decision", title: "Make one decision from the evidence", description: path.firstAction.afterCompletion, whyItMatters: "Validation creates value only when it changes what you do next.", completionRequirement: "Save a decision and explain which evidence supports it.", targetType: "decision_recorded", targetValue: 1, currentValue: 0, verificationMethod: "manual_with_detail", source: "milestone", href: `${hrefBase}?section=validate#validation-path`, primaryCta: "Record decision", estimatedTime: "10-15 minutes", done: false }),
    ];
  }
  const weeklyContactTarget = weeklyPeopleTarget(context);
  const weeklyPainTarget = context.founder.hoursPerWeek <= 5 ? 1 : 3;
  const candidates: FounderQuest[] = [
    quest({
      ...base,
      id: questId(input.project!.id, "weekly", periodKey, "validate", "talk-to-users"),
      category: "validate",
      title: `Talk to ${weeklyContactTarget} ${context.language.userNoun}`,
      description: `Ask how they handle ${lower(context.problem)} today. Do not pitch first.`,
      whyItMatters: "This creates the real-world input every other project decision depends on.",
      completionRequirement: "Record the conversations or outreach results in Proof Board.",
      targetType: "people_contacted",
      targetValue: weeklyContactTarget,
      currentValue: proof.people_contacted,
      verificationMethod: "evidence_record",
      source: "evidence_gap",
      href: `${hrefBase}?section=validate#proof-board`,
      primaryCta: "Log conversations",
      estimatedTime: weeklyScope(context),
      done: proof.people_contacted >= weeklyContactTarget,
    }),
    quest({
      ...base,
      id: questId(input.project!.id, "weekly", periodKey, "evidence", "record-pain-patterns"),
      category: "evidence",
      title: `Record ${weeklyPainTarget} repeated pain point${weeklyPainTarget === 1 ? "" : "s"}`,
      description: `Look for patterns in what ${context.language.userNoun} repeat. One clear pattern is better than ten vague notes.`,
      whyItMatters: "Patterns make the MVP smaller and the offer easier to explain.",
      completionRequirement: "Update Proof Board with pain confirmations or learnings.",
      targetType: "pain_confirmed",
      targetValue: weeklyPainTarget,
      currentValue: proof.pain_confirmed,
      verificationMethod: "evidence_record",
      source: "evidence_gap",
      href: `${hrefBase}?section=validate#proof-board`,
      primaryCta: "Update evidence",
      estimatedTime: weeklyScope(context),
      done: proof.pain_confirmed >= weeklyPainTarget,
    }),
    quest({
      ...base,
      id: questId(input.project!.id, "weekly", periodKey, "build", "test-one-version"),
      category: input.project!.status === "idea" || input.project!.status === "validating" ? "validate" : "build",
      title: projectTypeWeeklyBuildTitle(context),
      description: projectTypeWeeklyBuildDescription(context),
      whyItMatters: "A simple testable version beats a larger plan nobody has reacted to.",
      completionRequirement: projectTypeWeeklyBuildRequirement(context),
      targetType: "testable_version_prepared",
      targetValue: 1,
      currentValue: hasOutput(input.outputs, "landing_page_copy") || hasOutput(input.outputs, "sprint_tasks") ? 1 : 0,
      verificationMethod: "hybrid",
      source: input.project!.status === "building" ? "project_stage" : "milestone",
      href: `${hrefBase}?section=launch`,
      primaryCta: "Open launch section",
      estimatedTime: weeklyScope(context),
      done: false,
    }),
    quest({
      ...base,
      id: questId(input.project!.id, "weekly", periodKey, "decision", "make-evidence-decision"),
      category: "decision",
      title: "Make one evidence-based project decision",
      description: "Decide what changes because of what you learned this week: audience, problem, offer, MVP scope, or launch channel.",
      whyItMatters: "The goal is not to collect notes forever. The goal is to make better decisions.",
      completionRequirement: "Write the decision and the evidence that supports it.",
      targetType: "decision_recorded",
      targetValue: 1,
      currentValue: 0,
      verificationMethod: "manual_with_detail",
      source: "milestone",
      href: `${hrefBase}/value-proof`,
      primaryCta: "Open Value Proof",
      estimatedTime: "20-30 minutes",
      done: false,
    }),
  ];

  const deduped = dedupeQuests(candidates, dailyQuest);
  return deduped.slice(0, 4);
}

function adaptWeeklyQuests(quests: FounderQuest[], preferences?: FounderGuidancePreferences) {
  if (!preferences) return quests;
  return quests.slice(0, weeklyQuestLimit(preferences.questIntensity)).map((quest) => adaptQuestPresentation(quest, preferences));
}

function adaptQuestPresentation(quest: FounderQuest, preferences?: FounderGuidancePreferences): FounderQuest {
  if (!preferences) return quest;
  const alternatives = preferences.guidanceMode === "guided" ? quest.alternatives?.slice(0, 1) : preferences.guidanceMode === "balanced" ? quest.alternatives?.slice(0, 2) : quest.alternatives;
  return {
    ...quest,
    alternatives,
    metadata: { ...quest.metadata, trustWeight: quest.metadata.trustWeight },
  };
}

function quest(input: Omit<FounderQuest, "title" | "description" | "whyItMatters" | "completionRequirement"> & Pick<FounderQuest, "title" | "description" | "whyItMatters" | "completionRequirement">): FounderQuest {
  return {
    ...input,
    title: cleanGeneratedCopy(input.title, { heading: true, maxLength: 110 }),
    description: sentence(input.description),
    whyItMatters: sentence(input.whyItMatters),
    completionRequirement: sentence(input.completionRequirement),
  };
}

function missingFundamentals(report: OpportunityReport, context: ProjectContext) {
  const checks = [
    {
      key: "target_customer",
      done: hasText(report.summary?.targetCustomer) && !/target audience|intended audience/i.test(report.summary.targetCustomer),
      title: "Define who this project is for",
      description: `Write one specific audience, such as "student creators" or "local gym owners," instead of a broad group.`,
      completionRequirement: "Save a specific target customer on the project.",
    },
    {
      key: "pain_point",
      done: hasText(report.summary?.painPoint) && !/problem to validate|this problem/i.test(report.summary.painPoint),
      title: `Write the painful moment ${context.language.userNoun} experience`,
      description: `Describe the moment before your ${context.language.productNoun} helps, in plain language.`,
      completionRequirement: "Write one clear pain point that a real person could recognize.",
    },
    {
      key: "mvp_plan",
      done: hasAnyText(report.mvpPlan?.mustHaveFeatures) || hasAnyText(report.mvpPlan?.featureList),
      title: "Choose the smallest useful version",
      description: `Pick one workflow or service step ${context.language.userNoun} can test this week.`,
      completionRequirement: "Write the one feature, offer, or test that comes first.",
    },
  ];
  return checks.filter((check) => !check.done);
}

function metadata(project: QuestProject, context: ProjectContext, nextBestAction: string): FounderQuest["metadata"] {
  return {
    projectStatus: project.status,
    projectType: context.projectType,
    businessType: project.business_type,
    nextBestAction: nextBestAction.slice(0, 160),
    evidenceAttached: context.evidence.peopleContacted > 0 || context.evidence.replies > 0,
    trustWeight: "medium",
  };
}

function weeklyOutcomeFor(context: ProjectContext, proof: ProofSummary) {
  if (proof.people_contacted <= 0) return `This week: get the first real response from ${context.language.userNoun}.`;
  if (proof.pain_confirmed < 3) return "This week: learn whether the pain repeats across real people.";
  if (proof.interested_users + proof.waitlist_signups <= 0) return "This week: ask for one small commitment, not just compliments.";
  if (proof.payment_intent <= 0 && proof.preorders_or_revenue_cents <= 0) return "This week: test whether the value is strong enough to discuss price.";
  return `This week: move one step closer to a tiny ${context.language.releaseNoun}.`;
}

function projectTypeWeeklyBuildTitle(context: ProjectContext) {
  if (context.projectType === "Creator Business" || context.projectType === "Content Brand") return "Publish one content test and record the response";
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") return "Package one tiny pilot offer";
  if (context.projectType === "Course" || context.projectType === "Coaching") return "Test one pilot lesson outline";
  if (context.projectType === "Physical Product" || context.projectType === "Hardware") return "Show one rough mockup before building";
  if (context.projectType === "Marketplace") return "Test one side of the marketplace first";
  return `Prepare one tiny ${context.language.releaseNoun} test`;
}

function projectTypeWeeklyBuildDescription(context: ProjectContext) {
  if (context.projectType === "Creator Business" || context.projectType === "Content Brand") return "Choose one pain-point angle, publish it, and track replies, saves, comments, or subscribers.";
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") return "Write the outcome, scope, price or free pilot terms, and who you will offer it to.";
  if (context.projectType === "Course" || context.projectType === "Coaching") return "Outline one lesson that helps learners complete a visible outcome in one sitting.";
  if (context.projectType === "Physical Product" || context.projectType === "Hardware") return "Use a sketch, mockup, or description to test buyer reaction before spending money.";
  if (context.projectType === "Marketplace") return "Validate supply or demand first; do not try to solve both sides at once.";
  return `Prepare the smallest version ${context.language.userNoun} can react to this week.`;
}

function projectTypeWeeklyBuildRequirement(context: ProjectContext) {
  if (context.projectType === "Creator Business" || context.projectType === "Content Brand") return "Log what you published and what response it received.";
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Local Business") return "Write the pilot offer and send or show it to at least one likely buyer.";
  if (context.projectType === "Course" || context.projectType === "Coaching") return "Write the lesson outcome and test it with at least one learner or reviewer.";
  if (context.projectType === "Physical Product" || context.projectType === "Hardware") return "Record at least one buyer reaction to the mockup.";
  return "Record the test plan or evidence in Proof Board.";
}

function dailyScope(hoursPerWeek: number) {
  if (hoursPerWeek <= 5) return { tiny: "10-15 minutes", short: "10-30 minutes", medium: "20-30 minutes" };
  if (hoursPerWeek <= 10) return { tiny: "10-20 minutes", short: "20-45 minutes", medium: "30-60 minutes" };
  if (hoursPerWeek <= 20) return { tiny: "15-30 minutes", short: "30-60 minutes", medium: "45-90 minutes" };
  return { tiny: "20-30 minutes", short: "45-75 minutes", medium: "60-120 minutes" };
}

function weeklyScope(context: ProjectContext) {
  if (context.founder.hoursPerWeek <= 5) return "45-90 minutes this week";
  if (context.founder.hoursPerWeek <= 10) return "1-2 hours this week";
  if (context.founder.hoursPerWeek <= 20) return "2-4 hours this week";
  return "4-6 focused hours this week";
}

function firstContactTarget(context: ProjectContext) {
  if (context.founder.hoursPerWeek <= 5 || context.founder.riskTolerance <= 3) return 3;
  if (context.projectType === "Agency" || context.projectType === "Consulting") return 5;
  return 5;
}

function weeklyPeopleTarget(context: ProjectContext) {
  if (context.founder.hoursPerWeek <= 5) return 3;
  if (context.founder.hoursPerWeek <= 10) return 5;
  if (context.projectType === "Agency" || context.projectType === "Consulting" || context.projectType === "Creator Business") return 10;
  return 8;
}

function dedupeQuests(quests: FounderQuest[], dailyQuest: FounderQuest) {
  const seen = new Set([dailyQuest.targetType]);
  const output: FounderQuest[] = [];
  for (const quest of quests) {
    const key = `${quest.category}:${quest.targetType}`;
    if (seen.has(quest.targetType) && quest.cadence === "weekly") {
      if (quest.targetType === dailyQuest.targetType) continue;
    }
    if (output.some((item) => `${item.category}:${item.targetType}` === key)) continue;
    seen.add(quest.targetType);
    output.push(quest);
  }
  return output;
}

function localDayWindow(now: Date, timeZone: string) {
  const parts = dateParts(now, timeZone);
  const key = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return {
    key,
    startsAt: new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0)).toISOString(),
    dueAt: new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0)).toISOString(),
  };
}

function localWeekWindow(now: Date, timeZone: string) {
  const parts = dateParts(now, timeZone);
  const approx = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  const day = approx.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(approx);
  monday.setUTCDate(approx.getUTCDate() + mondayOffset);
  const sundayEnd = new Date(monday);
  sundayEnd.setUTCDate(monday.getUTCDate() + 7);
  const key = `${monday.getUTCFullYear()}-W${pad(weekNumber(monday))}`;
  return { key, startsAt: monday.toISOString(), dueAt: sundayEnd.toISOString() };
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate()),
  };
}

function weekNumber(date: Date) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - first.getTime()) / 86400000) + first.getUTCDay() + 1) / 7);
}

function questId(projectId: string, cadence: QuestCadence, periodKey: string, category: QuestCategory, target: string) {
  return [projectId, cadence, periodKey, category, target].join(":").toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

function hasOutput(outputs: ProjectOutput[] | undefined, outputType: string) {
  return (outputs ?? []).some((output) => output.output_type === outputType);
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAnyText(value: unknown) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function emptyProofSummary(): ProofSummary {
  return {
    people_contacted: 0,
    replies: 0,
    pain_confirmed: 0,
    interested_users: 0,
    waitlist_signups: 0,
    payment_intent: 0,
    preorders_or_revenue_cents: 0,
    experiment_count: 0,
    confidence_score: 0,
    confidence_label: "No evidence yet",
    evidence_sentence: "No evidence collected yet.",
    recommended_next_action: "Start with one small validation action.",
  };
}

function lower(value: string) {
  return cleanGeneratedCopy(value).replace(/^./, (match) => match.toLowerCase());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
