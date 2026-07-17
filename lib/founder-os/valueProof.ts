import type { AppEvent, OpportunityProject, ProjectOutput, ProjectValidationExperiment } from "../database.types";
import { detectPlaceholderAnswer } from "../input-quality/detectPlaceholderAnswer";
import type { ProofSummary } from "../proof-board";
import { GOAL_LABELS } from "./helpers";
import type { OpportunityReport, ProjectStatus } from "./types";

export type ScoreBand = "Missing" | "Developing" | "Ready" | "Strong";

export type ScoreItem = {
  key: string;
  label: string;
  score: number;
  max: number;
  band: ScoreBand;
  note: string;
};

export type ValueProofSourceType =
  | "original_user_input"
  | "current_project_field"
  | "founder_profile"
  | "proof_board_entry"
  | "project_output"
  | "app_event"
  | "prismforge_recommendation"
  | "derived_summary";

export type ValueProofSource = {
  type: ValueProofSourceType;
  label: string;
  id?: string;
  timestamp?: string;
};

export type ValueProofTextItem = {
  title: string;
  detail: string;
  source: ValueProofSource;
};

export type ClarityFundamental = ValueProofTextItem & {
  key: string;
  defined: boolean;
};

export type AssumptionStatus = "Untested" | "Partially supported" | "Supported by recorded evidence" | "Contradicted" | "Inconclusive";

export type AssumptionEvidenceItem = {
  assumption: string;
  evidence: string;
  status: AssumptionStatus;
  source: ValueProofSource;
};

export type EvidenceCollectedItem = ValueProofTextItem & {
  count: number;
};

export type ValueProofSnapshot = {
  projectId: string;
  generatedAt: string;
  historyStatus: "original_input_preserved" | "limited_history";
  startingPoint: {
    originalIdea?: string;
    originalAudience?: string;
    originalProblem?: string;
    originalDesiredOutcome?: string;
    originalConstraints: {
      hoursPerWeek?: number;
      budget?: number;
      riskTolerance?: string;
      technicalAbility?: string;
    };
    source: ValueProofSource;
  };
  currentState: {
    projectSummary: string;
    audience: string;
    problem: string;
    valueProposition: string;
    currentStage: ProjectStatus;
    nextBestAction: string;
    source: ValueProofSource;
  };
  clarityGained: ValueProofTextItem[];
  assumptionsIdentified: AssumptionEvidenceItem[];
  evidenceCollected: EvidenceCollectedItem[];
  decisionsRecorded: ValueProofTextItem[];
  actionsCompleted: ValueProofTextItem[];
  milestonesReached: ValueProofTextItem[];
  prismForgeContribution: ValueProofTextItem[];
  founderContribution: ValueProofTextItem[];
  stillUnknown: ValueProofTextItem[];
  nextStep: {
    action: string;
    whyNow: string;
    whatThisWillProve: string;
    successCondition: string;
    source: ValueProofSource;
  };
  timeline: ValueProofTextItem[];
};

export type ValueProofReport = {
  snapshot: ValueProofSnapshot;
  clarityDefinedCount: number;
  clarityTotalCount: number;
  clarityFundamentals: ClarityFundamental[];
  evidenceItemCount: number;
  clarityScore: number;
  evidenceScore: number;
  clarityBreakdown: ScoreItem[];
  evidenceBreakdown: ScoreItem[];
  startingPoint: string | null;
  structuredProject: string;
  whatPrismForgeAdded: string[];
  whatUserProved: string[];
  potentialWasteAvoided: string[];
  assumptionsVsEvidence: Array<{ assumption: string; evidence: string; status: "Untested" | "Weak evidence" | "Supported" | "Contradicted" }>;
  progressSinceStart: string[];
  outcomeTimeline: Array<{ date: string; label: string; detail: string }>;
  decisionHistory: Array<{ date: string; change: string; reason: string }>;
  timeToStructureLabel: string | null;
  estimatedTimeSaved: null;
  currentBiggestRisk: string;
  nextBestAction: {
    action: string;
    whyNow: string;
    whatThisWillProve: string;
    successCondition: string;
  };
  shareSummary: string;
};

export function buildValueProofReport({
  project,
  report,
  proof,
  experiments,
  outputs,
  appEvents = [],
}: {
  project: Pick<OpportunityProject, "id" | "title" | "status" | "created_at" | "updated_at" | "target_customer" | "score">;
  report: OpportunityReport;
  proof: ProofSummary;
  experiments: ProjectValidationExperiment[];
  outputs: ProjectOutput[];
  appEvents?: AppEvent[];
}): ValueProofReport {
  const clarityBreakdown = scoreProjectClarity(report);
  const evidenceBreakdown = scoreEvidence(proof, experiments);
  const clarityFundamentals = buildClarityFundamentals(report, project);
  const clarityDefinedCount = clarityFundamentals.filter((item) => item.defined).length;
  const clarityTotalCount = clarityFundamentals.length;
  const evidenceCollected = evidenceItems(experiments, proof);
  const startingPoint = originalStartingPoint(report);
  const structuredProject = report.summary.oneSentenceIdea;
  const nextBestAction = explainNextBestAction(report, proof);
  const assumptions = assumptionEvidence(report, proof);
  const decisions = decisionItems(project, proof, experiments);
  const contributions = prismForgeAdded(report, outputs, proof);
  const founderContributions = founderContributionItems(proof, experiments);
  const timeline = timelineItems(project, proof, experiments, appEvents);
  const snapshot: ValueProofSnapshot = {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    historyStatus: report.input ? "original_input_preserved" : "limited_history",
    startingPoint: {
      originalIdea: cleanOptional(report.input?.existingIdea),
      originalAudience: cleanOptional(report.input?.targetAudience),
      originalProblem: undefined,
      originalDesiredOutcome: report.input?.goal ? GOAL_LABELS[report.input.goal] : undefined,
      originalConstraints: {
        hoursPerWeek: report.input?.timePerWeek,
        budget: report.input?.budget,
        riskTolerance: typeof report.input?.riskTolerance === "number" ? `${report.input.riskTolerance}/10` : undefined,
        technicalAbility: inferTechnicalAbility(report.input?.skills ?? ""),
      },
      source: source("original_user_input", "Saved creation answers", project.id, project.created_at),
    },
    currentState: {
      projectSummary: report.summary.oneSentenceIdea,
      audience: report.summary.targetCustomer,
      problem: report.summary.painPoint,
      valueProposition: report.summary.whyThisCouldMakeMoney,
      currentStage: project.status,
      nextBestAction: nextBestAction.action,
      source: source("current_project_field", "Current project report", project.id, project.updated_at),
    },
    clarityGained: clarityChanges(report, project),
    assumptionsIdentified: assumptions,
    evidenceCollected,
    decisionsRecorded: decisions.map((item) => ({
      title: item.change,
      detail: item.reason,
      source: source("derived_summary", "Decision summary", project.id, item.date),
    })),
    actionsCompleted: completedActionItems(experiments, proof),
    milestonesReached: milestoneItems(project, proof, experiments),
    prismForgeContribution: contributions,
    founderContribution: founderContributions,
    stillUnknown: unknownItems(report, proof),
    nextStep: {
      ...nextBestAction,
      source: source("prismforge_recommendation", "Next Best Action logic", project.id, project.updated_at),
    },
    timeline: timeline.map((item) => ({ title: item.label, detail: item.detail, source: source("derived_summary", item.label, project.id, item.date) })),
  };

  const evidenceScore = sumScore(evidenceBreakdown);
  return {
    snapshot,
    clarityDefinedCount,
    clarityTotalCount,
    clarityFundamentals,
    evidenceItemCount: evidenceCollected.length,
    clarityScore: Math.round((clarityDefinedCount / Math.max(1, clarityTotalCount)) * 100),
    evidenceScore,
    clarityBreakdown,
    evidenceBreakdown,
    startingPoint,
    structuredProject,
    whatPrismForgeAdded: contributions.map((item) => item.detail),
    whatUserProved: userProofItems(proof),
    potentialWasteAvoided: wasteAvoided(report, proof),
    assumptionsVsEvidence: assumptions.map((item) => ({
      assumption: item.assumption,
      evidence: item.evidence,
      status: item.status === "Supported by recorded evidence" ? "Supported" : item.status === "Partially supported" ? "Weak evidence" : item.status === "Contradicted" ? "Contradicted" : "Untested",
    })),
    progressSinceStart: progressItems(project, proof, experiments, outputs),
    outcomeTimeline: timeline,
    decisionHistory: decisions,
    timeToStructureLabel: timeToStructure(appEvents, project.id),
    estimatedTimeSaved: null,
    currentBiggestRisk: biggestRisk(report, proof),
    nextBestAction: {
      action: nextBestAction.action,
      whyNow: nextBestAction.whyNow,
      whatThisWillProve: nextBestAction.whatThisWillProve,
      successCondition: nextBestAction.successCondition,
    },
    shareSummary: buildShareSummary({ project, report, proof, evidenceScore, nextAction: nextBestAction.action, startingPoint, clarityDefinedCount, clarityTotalCount }),
  };
}

export function scoreProjectClarity(report: OpportunityReport): ScoreItem[] {
  return [
    scoreText("audience", "Audience", report.summary.targetCustomer, 15, "Specific target customer defined."),
    scoreText("problem", "Problem", report.summary.painPoint, 15, "Pain point is written clearly."),
    scoreText("solution", "Solution", report.summary.oneSentenceIdea, 15, "Concept connects audience, pain, and solution."),
    scoreList("mvp", "MVP", report.mvpPlan.mustHaveFeatures, 15, "Smallest build scope is defined."),
    scoreList("validation", "Validation Plan", report.executionRoadmap.howToTestQuickly, 15, "There is a concrete validation path."),
    scoreList("next_action", "Next Action", report.executionRoadmap.today, 15, "The next action is clear enough to do now."),
    scoreText("business_model", "Business Model", report.summary.businessModel, 10, "The monetization direction is described."),
  ];
}

export function scoreEvidence(proof: ProofSummary, experiments: ProjectValidationExperiment[] = []): ScoreItem[] {
  return [
    scoreNumber("outreach", "People Contacted", proof.people_contacted, 20, 10, "Real outreach logged."),
    scoreNumber("replies", "Replies", proof.replies, 20, 4, "People replied to the outreach."),
    scoreNumber("pain", "Pain Confirmed", proof.pain_confirmed, 20, 3, "People confirmed the problem."),
    scoreNumber("interest", "Interested Users", proof.interested_users, 15, 2, "People expressed interest."),
    scoreNumber("waitlist", "Waitlist", proof.waitlist_signups, 10, 1, "Someone joined or committed to a beta list."),
    scoreNumber("payment", "Payment Intent", proof.payment_intent, 10, 1, "Someone showed willingness to pay."),
    scoreNumber("revenue", "Revenue", proof.preorders_or_revenue_cents > 0 ? 1 : 0, 5, 1, "Revenue or preorder money was logged."),
    scoreNumber("experiments", "Completed Experiments", experiments.filter((experiment) => experiment.status === "completed").length, 10, 1, "A validation experiment was completed."),
  ];
}

function buildClarityFundamentals(report: OpportunityReport, project: Pick<OpportunityProject, "id" | "created_at" | "updated_at" | "status">): ClarityFundamental[] {
  return [
    clarity("audience", "Target audience", hasSpecificText(report.summary.targetCustomer), report.summary.targetCustomer, "current_project_field", project),
    clarity("problem", "Primary problem", hasSpecificText(report.summary.painPoint), report.summary.painPoint, "current_project_field", project),
    clarity("outcome", "Desired outcome", hasSpecificText(report.summary.oneSentenceIdea), report.summary.oneSentenceIdea, "current_project_field", project),
    clarity("mvp", "Smallest MVP", (report.mvpPlan.mustHaveFeatures ?? []).length > 0, report.mvpPlan.mustHaveFeatures[0] ?? "No MVP scope recorded yet.", "prismforge_recommendation", project),
    clarity("constraints", "Founder constraints", Boolean(report.input?.timePerWeek || report.input?.budget || report.input?.riskTolerance), constraintSentence(report), "original_user_input", project),
    clarity("assumption", "Main assumption", hasSpecificText(report.marketValidation.underservedAngle), report.marketValidation.underservedAngle, "prismforge_recommendation", project),
    clarity("stage", "Current stage", Boolean(project.status), `Current stage is ${project.status}.`, "current_project_field", project),
    clarity("next_action", "Next action", (report.executionRoadmap.today ?? []).length > 0, report.executionRoadmap.today[0] ?? "No next action recorded yet.", "prismforge_recommendation", project),
    clarity("success_condition", "Evidence requirement", (report.executionRoadmap.howToTestQuickly ?? []).length > 0, report.executionRoadmap.howToTestQuickly[0] ?? "No validation requirement recorded yet.", "prismforge_recommendation", project),
    clarity("not_yet", "Scope boundary", (report.mvpPlan.doNotBuildYet ?? []).length > 0, report.mvpPlan.doNotBuildYet[0] ?? "No scope boundary recorded yet.", "prismforge_recommendation", project),
  ];
}

function clarity(key: string, title: string, defined: boolean, detail: string, sourceType: ValueProofSourceType, project: Pick<OpportunityProject, "id" | "created_at" | "updated_at">): ClarityFundamental {
  return {
    key,
    title,
    defined,
    detail: defined ? detail : "Not defined clearly yet.",
    source: source(sourceType, title, project.id, sourceType === "original_user_input" ? project.created_at : project.updated_at),
  };
}

function clarityChanges(report: OpportunityReport, project: Pick<OpportunityProject, "id" | "created_at" | "updated_at" | "target_customer">): ValueProofTextItem[] {
  const originalAudience = cleanOptional(report.input?.targetAudience);
  const currentAudience = cleanOptional(report.summary.targetCustomer);
  const items: ValueProofTextItem[] = [];

  if (originalAudience && currentAudience && normalize(originalAudience) !== normalize(currentAudience)) {
    items.push({
      title: "Audience became more specific",
      detail: `Changed from "${originalAudience}" to "${currentAudience}".`,
      source: source("current_project_field", "Current target customer", project.id, project.updated_at),
    });
  } else if (currentAudience) {
    items.push({
      title: "Audience is captured",
      detail: `The project has a named target audience: ${currentAudience}.`,
      source: source("current_project_field", "Current target customer", project.id, project.updated_at),
    });
  }

  if (report.input?.existingIdea && normalize(report.input.existingIdea) === normalize(report.summary.oneSentenceIdea)) {
    items.push({
      title: "Strong original idea preserved",
      detail: "PrismForge kept the founder's original wording because it was already specific.",
      source: source("original_user_input", "Original idea", project.id, project.created_at),
    });
  } else if (hasSpecificText(report.summary.oneSentenceIdea)) {
    items.push({
      title: "Project statement organized",
      detail: "The project now has a single audience/problem/solution statement.",
      source: source("current_project_field", "Structured project statement", project.id, project.updated_at),
    });
  }

  items.push({
    title: "Constraints are part of the plan",
    detail: constraintSentence(report),
    source: source("original_user_input", "Founder constraints", project.id, project.created_at),
  });

  if (report.mvpPlan.doNotBuildYet[0]) {
    items.push({
      title: "Scope boundary identified",
      detail: `Not building yet: ${report.mvpPlan.doNotBuildYet[0]}`,
      source: source("prismforge_recommendation", "MVP scope boundary", project.id, project.updated_at),
    });
  }

  return items.slice(0, 6);
}

function evidenceItems(experiments: ProjectValidationExperiment[], proof: ProofSummary): EvidenceCollectedItem[] {
  const items = experiments.flatMap((experiment) => {
    const sourceRef = source("proof_board_entry", experiment.title, experiment.id, experiment.updated_at);
    return [
      experiment.people_contacted > 0 ? evidence(`${experiment.people_contacted} people contacted`, experiment.title, experiment.people_contacted, sourceRef) : null,
      experiment.replies > 0 ? evidence(`${experiment.replies} replies recorded`, experiment.title, experiment.replies, sourceRef) : null,
      experiment.pain_confirmed > 0 ? evidence(`${experiment.pain_confirmed} pain confirmations`, experiment.title, experiment.pain_confirmed, sourceRef) : null,
      experiment.interested_users > 0 ? evidence(`${experiment.interested_users} interested users`, experiment.title, experiment.interested_users, sourceRef) : null,
      experiment.waitlist_signups > 0 ? evidence(`${experiment.waitlist_signups} waitlist signups`, experiment.title, experiment.waitlist_signups, sourceRef) : null,
      experiment.payment_intent > 0 ? evidence(`${experiment.payment_intent} payment-intent signals`, experiment.title, experiment.payment_intent, sourceRef) : null,
      experiment.preorders_or_revenue_cents > 0 ? evidence("Revenue or preorder money recorded", experiment.title, experiment.preorders_or_revenue_cents, sourceRef) : null,
    ];
  }).filter(Boolean) as EvidenceCollectedItem[];

  if (!items.length && proof.experiment_count > 0) {
    return [{
      title: "Proof Board started",
      detail: "Experiments exist, but no external evidence counts have been recorded yet.",
      count: proof.experiment_count,
      source: source("proof_board_entry", "Proof Board", undefined),
    }];
  }
  return items;
}

function evidence(title: string, experimentTitle: string, count: number, sourceRef: ValueProofSource): EvidenceCollectedItem {
  return { title, detail: `Recorded in Proof Board experiment: ${experimentTitle}.`, count, source: sourceRef };
}

function prismForgeAdded(report: OpportunityReport, outputs: ProjectOutput[], proof: ProofSummary): ValueProofTextItem[] {
  const outputTypes = new Set(outputs.map((output) => output.output_type));
  const projectSource = source("current_project_field", "Structured report", undefined, report.generatedAt);
  const items: Array<ValueProofTextItem | null> = [
    itemText("Organized the starting answers", "Created a saved project with audience, problem, MVP scope, assumptions, and next action.", source("original_user_input", "Creation answers", undefined, report.generatedAt)),
    itemText("Separated plan from proof", "The project keeps assumptions separate from evidence recorded in Proof Board.", projectSource),
    report.executionRoadmap.today[0] ? itemText("Defined a next action", report.executionRoadmap.today[0], source("prismforge_recommendation", "Execution roadmap", undefined, report.generatedAt)) : null,
    report.mvpPlan.doNotBuildYet[0] ? itemText("Flagged what not to build yet", report.mvpPlan.doNotBuildYet[0], source("prismforge_recommendation", "MVP plan", undefined, report.generatedAt)) : null,
    outputTypes.has("validation_survey") ? outputContribution(outputs, "validation_survey", "Generated a validation survey") : null,
    outputTypes.has("pricing_tiers") ? outputContribution(outputs, "pricing_tiers", "Drafted pricing options") : null,
    outputTypes.has("sprint_tasks") ? outputContribution(outputs, "sprint_tasks", "Created sprint tasks") : null,
    proof.experiment_count ? itemText("Organized real-world evidence", "Proof Board connects experiments, counts, quotes, learnings, and next actions to this project.", source("proof_board_entry", "Proof Board", undefined)) : null,
  ];
  return items.filter(Boolean) as ValueProofTextItem[];
}

function outputContribution(outputs: ProjectOutput[], outputType: ProjectOutput["output_type"], title: string) {
  const output = outputs.find((item) => item.output_type === outputType);
  return itemText(title, "Saved as a reusable project output. This is not counted as evidence.", source("project_output", outputType, output?.id, output?.updated_at));
}

function founderContributionItems(proof: ProofSummary, experiments: ProjectValidationExperiment[]): ValueProofTextItem[] {
  const items = [
    proof.people_contacted ? itemText("Contacted people", `${proof.people_contacted} potential users contacted.`, source("proof_board_entry", "Proof Board")) : null,
    proof.replies ? itemText("Collected replies", `${proof.replies} replies recorded.`, source("proof_board_entry", "Proof Board")) : null,
    proof.pain_confirmed ? itemText("Logged pain confirmations", `${proof.pain_confirmed} people confirmed the pain.`, source("proof_board_entry", "Proof Board")) : null,
    proof.waitlist_signups ? itemText("Collected waitlist interest", `${proof.waitlist_signups} waitlist signups recorded.`, source("proof_board_entry", "Proof Board")) : null,
    proof.payment_intent ? itemText("Tested payment intent", `${proof.payment_intent} payment-intent signals recorded.`, source("proof_board_entry", "Proof Board")) : null,
    ...experiments.filter((experiment) => experiment.learnings).map((experiment) => itemText("Recorded learning", experiment.learnings ?? "", source("proof_board_entry", experiment.title, experiment.id, experiment.updated_at))),
  ].filter(Boolean) as ValueProofTextItem[];
  return items.length ? items : [itemText("No external founder action recorded yet", "Complete a validation step to begin building proof.", source("derived_summary", "Empty state"))];
}

function userProofItems(proof: ProofSummary) {
  const items = [
    proof.people_contacted ? `Contacted ${proof.people_contacted} potential user${proof.people_contacted === 1 ? "" : "s"}.` : null,
    proof.replies ? `Received ${proof.replies} repl${proof.replies === 1 ? "y" : "ies"}.` : null,
    proof.pain_confirmed ? `${proof.pain_confirmed} people confirmed the pain.` : null,
    proof.interested_users ? `${proof.interested_users} interested user${proof.interested_users === 1 ? "" : "s"} logged.` : null,
    proof.waitlist_signups ? `${proof.waitlist_signups} waitlist signup${proof.waitlist_signups === 1 ? "" : "s"} logged.` : null,
    proof.payment_intent ? `${proof.payment_intent} payment-intent signal${proof.payment_intent === 1 ? "" : "s"} logged.` : null,
    proof.preorders_or_revenue_cents > 0 ? "Revenue or preorder money was logged." : null,
  ].filter(Boolean) as string[];
  return items.length ? items : ["No external evidence recorded yet. Complete a validation step to begin building proof."];
}

function wasteAvoided(report: OpportunityReport, proof: ProofSummary) {
  return [
    report.mvpPlan.doNotBuildYet[0] ? `Scope boundary: ${report.mvpPlan.doNotBuildYet[0]}` : null,
    proof.people_contacted === 0 ? "Validation remains ahead of overbuilding because no outreach is logged yet." : null,
    proof.people_contacted > 0 && proof.replies / Math.max(1, proof.people_contacted) < 0.25 ? "Recorded evidence suggests the outreach angle may need sharpening before launch." : null,
    proof.pain_confirmed >= 3 && proof.payment_intent === 0 ? "Pain is emerging, but willingness to pay is still untested." : null,
  ].filter(Boolean) as string[];
}

function assumptionEvidence(report: OpportunityReport, proof: ProofSummary): AssumptionEvidenceItem[] {
  return [
    {
      assumption: `${report.summary.targetCustomer} experience this problem strongly enough to discuss it.`,
      evidence: proof.pain_confirmed ? `${proof.pain_confirmed} pain confirmation${proof.pain_confirmed === 1 ? "" : "s"} recorded.` : "No pain confirmations recorded yet.",
      status: proof.pain_confirmed >= 3 ? "Supported by recorded evidence" : proof.pain_confirmed > 0 ? "Partially supported" : "Untested",
      source: source("proof_board_entry", "Pain evidence"),
    },
    {
      assumption: "The audience is willing to take a next step.",
      evidence: proof.interested_users + proof.waitlist_signups ? `${proof.interested_users + proof.waitlist_signups} interest or waitlist signal${proof.interested_users + proof.waitlist_signups === 1 ? "" : "s"} recorded.` : "No interest or waitlist signal recorded yet.",
      status: proof.interested_users + proof.waitlist_signups >= 2 ? "Supported by recorded evidence" : proof.interested_users + proof.waitlist_signups > 0 ? "Partially supported" : "Untested",
      source: source("proof_board_entry", "Interest evidence"),
    },
    {
      assumption: "People may pay for the solution.",
      evidence: proof.payment_intent || proof.preorders_or_revenue_cents > 0 ? `${proof.payment_intent} payment-intent signal${proof.payment_intent === 1 ? "" : "s"}${proof.preorders_or_revenue_cents > 0 ? " plus revenue/preorders." : "."}` : "No payment evidence recorded yet.",
      status: proof.preorders_or_revenue_cents > 0 || proof.payment_intent > 0 ? "Supported by recorded evidence" : "Untested",
      source: source("proof_board_entry", "Payment evidence"),
    },
  ];
}

function progressItems(project: Pick<OpportunityProject, "created_at" | "status">, proof: ProofSummary, experiments: ProjectValidationExperiment[], outputs: ProjectOutput[]) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(project.created_at).getTime()) / 86_400_000));
  return [
    `Project active for ${days} day${days === 1 ? "" : "s"}.`,
    `Current stage: ${project.status}.`,
    outputs.length ? `${outputs.length} saved project output${outputs.length === 1 ? "" : "s"}. AI outputs are not counted as evidence.` : null,
    experiments.length ? `${experiments.length} Proof Board experiment${experiments.length === 1 ? "" : "s"} created.` : null,
    experiments.filter((experiment) => experiment.status === "completed").length ? `${experiments.filter((experiment) => experiment.status === "completed").length} validation experiment${experiments.filter((experiment) => experiment.status === "completed").length === 1 ? "" : "s"} completed.` : null,
    proof.people_contacted ? `${proof.people_contacted} people contacted.` : null,
    proof.replies ? `${proof.replies} replies received.` : null,
    proof.pain_confirmed ? `${proof.pain_confirmed} pain confirmations recorded.` : null,
    proof.payment_intent ? `${proof.payment_intent} payment-intent signals recorded.` : null,
  ].filter(Boolean) as string[];
}

function timelineItems(project: Pick<OpportunityProject, "created_at" | "updated_at" | "status">, proof: ProofSummary, experiments: ProjectValidationExperiment[], appEvents: AppEvent[] = []) {
  const meaningfulEvents = appEvents
    .filter((event) => event.event_name === "project_creation_completed" || event.event_name === "project_database_save_completed" || event.event_name === "first_evidence_saved")
    .slice(0, 8)
    .map((event) => ({ date: event.created_at, label: labelForEvent(event.event_name), detail: "Recorded by PrismForge system events." }));
  const items = [
    { date: project.created_at, label: "Project created", detail: "PrismForge structured the starting idea into a project workspace." },
    { date: project.created_at, label: "Audience, problem, and MVP defined", detail: "The project gained a target customer, pain point, MVP, and validation path." },
    ...meaningfulEvents,
    ...experiments.map((experiment) => ({ date: experiment.created_at, label: "Validation experiment created", detail: experiment.title })),
    ...experiments.filter((experiment) => experiment.status === "completed").map((experiment) => ({ date: experiment.updated_at, label: "Validation experiment completed", detail: experiment.title })),
    proof.replies ? { date: project.updated_at, label: "Replies recorded", detail: `${proof.replies} real-world repl${proof.replies === 1 ? "y" : "ies"} recorded.` } : null,
    proof.pain_confirmed ? { date: project.updated_at, label: "Pain confirmations recorded", detail: `${proof.pain_confirmed} pain confirmation${proof.pain_confirmed === 1 ? "" : "s"} recorded.` } : null,
    proof.payment_intent ? { date: project.updated_at, label: "Payment intent recorded", detail: `${proof.payment_intent} payment-intent signal${proof.payment_intent === 1 ? "" : "s"} recorded.` } : null,
    project.status !== "idea" ? { date: project.updated_at, label: `Moved to ${project.status}`, detail: "Project stage moved beyond idea mode." } : null,
  ].filter(Boolean) as Array<{ date: string; label: string; detail: string }>;
  return dedupeTimeline(items).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function decisionItems(project: Pick<OpportunityProject, "created_at" | "updated_at" | "status">, proof: ProofSummary, experiments: ProjectValidationExperiment[]) {
  return [
    { date: project.created_at, change: "Created structured project direction", reason: "PrismForge converted the starting answers into a saved workspace." },
    project.status !== "idea" ? { date: project.updated_at, change: `Project moved to ${project.status}`, reason: "Status reflects current founder stage." } : null,
    proof.pain_confirmed >= 3 ? { date: project.updated_at, change: "Pain assumption became better supported", reason: `${proof.pain_confirmed} people confirmed the problem.` } : null,
    proof.payment_intent > 0 ? { date: project.updated_at, change: "Payment assumption gained support", reason: `${proof.payment_intent} payment-intent signal${proof.payment_intent === 1 ? "" : "s"} recorded.` } : null,
    ...experiments.filter((experiment) => experiment.learnings || experiment.next_action).map((experiment) => ({
      date: experiment.updated_at,
      change: `Updated validation learning: ${experiment.title}`,
      reason: experiment.learnings || experiment.next_action || "Proof Board result updated.",
    })),
  ].filter(Boolean) as ValueProofReport["decisionHistory"];
}

function completedActionItems(experiments: ProjectValidationExperiment[], proof: ProofSummary): ValueProofTextItem[] {
  const completed = experiments.filter((experiment) => experiment.status === "completed");
  const items = completed.map((experiment) => itemText("Completed validation experiment", experiment.title, source("proof_board_entry", experiment.title, experiment.id, experiment.updated_at)));
  if (proof.people_contacted > 0) items.push(itemText("Contacted target users", `${proof.people_contacted} people contacted.`, source("proof_board_entry", "Outreach totals")));
  return items.length ? items : [itemText("No completed external action yet", "Complete your Next Best Action or record a Proof Board experiment to build history.", source("derived_summary", "Empty state"))];
}

function milestoneItems(project: Pick<OpportunityProject, "id" | "status" | "created_at" | "updated_at">, proof: ProofSummary, experiments: ProjectValidationExperiment[]): ValueProofTextItem[] {
  const items = [
    itemText("Project structured", "Starting answers became a saved project workspace.", source("app_event", "Project created", project.id, project.created_at)),
    experiments.length ? itemText("Proof Board started", `${experiments.length} experiment${experiments.length === 1 ? "" : "s"} created.`, source("proof_board_entry", "Proof Board")) : null,
    proof.replies ? itemText("First response signal", `${proof.replies} replies recorded.`, source("proof_board_entry", "Replies")) : null,
    proof.payment_intent || proof.preorders_or_revenue_cents ? itemText("Payment signal recorded", "At least one payment-intent or revenue signal exists.", source("proof_board_entry", "Payment evidence")) : null,
    project.status !== "idea" ? itemText("Stage moved forward", `Current stage: ${project.status}.`, source("current_project_field", "Project status", project.id, project.updated_at)) : null,
  ].filter(Boolean) as ValueProofTextItem[];
  return items;
}

function unknownItems(report: OpportunityReport, proof: ProofSummary): ValueProofTextItem[] {
  return [
    proof.people_contacted === 0 ? itemText("Whether users experience the pain", "No real-world outreach has been recorded yet.", source("proof_board_entry", "Proof Board")) : null,
    proof.pain_confirmed < 3 ? itemText("Pain strength", "Fewer than 3 pain confirmations are recorded.", source("proof_board_entry", "Pain evidence")) : null,
    proof.payment_intent === 0 && proof.preorders_or_revenue_cents <= 0 ? itemText("Willingness to pay", "No payment-intent or revenue evidence is recorded yet.", source("proof_board_entry", "Payment evidence")) : null,
    itemText("Competitive truth", report.marketValidation.competitorLandscape || "Competitor assumptions still need founder research.", source("prismforge_recommendation", "Market assumptions")),
  ].filter(Boolean) as ValueProofTextItem[];
}

function timeToStructure(events: AppEvent[], projectId: string) {
  const completed = events
    .filter((event) => event.event_name === "project_creation_completed" || event.event_name === "generate_project_completed")
    .map((event) => event.metadata as Record<string, unknown>)
    .find((metadata) => metadata.project_id === projectId);
  const duration = typeof completed?.duration_ms === "number" ? completed.duration_ms : null;
  if (!duration || duration <= 0) return null;
  const seconds = Math.round(duration / 1000);
  if (seconds < 60) return `Structured project created in ${seconds} seconds.`;
  return `Structured project created in ${Math.floor(seconds / 60)} min ${seconds % 60} sec.`;
}

function biggestRisk(report: OpportunityReport, proof: ProofSummary) {
  if (proof.people_contacted === 0) return "No real-world outreach has been recorded yet.";
  if (proof.replies === 0) return "People have been contacted, but no replies are recorded yet.";
  if (proof.pain_confirmed < 3) return "The pain point is not strongly supported yet.";
  if (proof.payment_intent === 0 && proof.preorders_or_revenue_cents <= 0) return "Willingness to pay is still untested.";
  return report.executionRoadmap.biggestRisks[0] ?? "Keep validating before expanding the MVP.";
}

function explainNextBestAction(report: OpportunityReport, proof: ProofSummary) {
  if (proof.people_contacted === 0) {
    return {
      action: `Contact 5 ${report.summary.targetCustomer}.`,
      whyNow: "You have a structured idea but no external evidence yet.",
      whatThisWillProve: "Whether the pain is common enough to keep pursuing.",
      successCondition: "At least 2 people describe the same pain without being led.",
    };
  }
  if (proof.pain_confirmed < 3) {
    return {
      action: "Ask clearer pain questions and record the answers.",
      whyNow: "Replies exist, but the pain is not strongly supported yet.",
      whatThisWillProve: "Whether the problem matters to the audience.",
      successCondition: "3 people independently confirm the pain.",
    };
  }
  if (proof.payment_intent === 0 && proof.preorders_or_revenue_cents <= 0) {
    return {
      action: "Test payment intent with interested users.",
      whyNow: "Pain exists, but willingness to pay is unproven.",
      whatThisWillProve: "Whether the problem is valuable enough for a paid offer.",
      successCondition: "At least 1 person says they would pay or joins a paid beta.",
    };
  }
  return {
    action: report.executionRoadmap.today[0] ?? "Invite testers to a tiny MVP.",
    whyNow: "You have early evidence signal.",
    whatThisWillProve: "Whether the solution creates repeatable value.",
    successCondition: "A tester uses the MVP and gives specific feedback.",
  };
}

function buildShareSummary({
  project,
  report,
  proof,
  evidenceScore,
  nextAction,
  startingPoint,
  clarityDefinedCount,
  clarityTotalCount,
}: {
  project: Pick<OpportunityProject, "title">;
  report: OpportunityReport;
  proof: ProofSummary;
  evidenceScore: number;
  nextAction: string;
  startingPoint: string | null;
  clarityDefinedCount: number;
  clarityTotalCount: number;
}) {
  return [
    "PrismForge Value Proof",
    "",
    `Project: ${project.title}`,
    startingPoint ? `Started with: ${startingPoint}` : "Started with: original starting inputs were not recorded.",
    `Current direction: ${report.summary.oneSentenceIdea}`,
    "",
    "What is defined:",
    `- ${clarityDefinedCount} of ${clarityTotalCount} project fundamentals`,
    "",
    "External evidence recorded:",
    `- ${proof.people_contacted} users contacted`,
    `- ${proof.replies} replies`,
    `- ${proof.pain_confirmed} pain confirmations`,
    `- ${proof.interested_users + proof.waitlist_signups} interest/waitlist signals`,
    `- ${proof.payment_intent} payment-intent signals`,
    "",
    `Evidence signal: ${evidenceScore}/100 deterministic proof-board score`,
    `Next action: ${nextAction}`,
    "",
    "Note: AI outputs and page views are not counted as evidence.",
  ].join("\n");
}

function scoreText(key: string, label: string, value: string | null | undefined, max: number, note: string): ScoreItem {
  const text = String(value ?? "").trim();
  if (!text || detectPlaceholderAnswer(text, "generic").isPlaceholder) return scoreItem(key, label, 0, max, "Missing", "Missing or placeholder.");
  if (text.split(/\s+/).length <= 2) return scoreItem(key, label, Math.round(max * 0.35), max, "Developing", "Present, but still broad.");
  if (text.length < 45) return scoreItem(key, label, Math.round(max * 0.7), max, "Ready", note);
  return scoreItem(key, label, max, max, "Strong", note);
}

function scoreList(key: string, label: string, value: string[] | null | undefined, max: number, note: string): ScoreItem {
  const items = (value ?? []).filter((entry) => entry.trim().length > 0 && !detectPlaceholderAnswer(entry, "generic").isPlaceholder);
  if (!items.length) return scoreItem(key, label, 0, max, "Missing", "No usable items yet.");
  if (items.length === 1) return scoreItem(key, label, Math.round(max * 0.6), max, "Developing", note);
  return scoreItem(key, label, max, max, "Strong", note);
}

function scoreNumber(key: string, label: string, value: number, max: number, target: number, note: string): ScoreItem {
  const safe = Math.max(0, Number(value ?? 0));
  const score = Math.min(max, Math.round((safe / Math.max(1, target)) * max));
  return scoreItem(key, label, score, max, band(score, max), safe ? note : "No real-world evidence recorded yet.");
}

function scoreItem(key: string, label: string, score: number, max: number, bandValue: ScoreBand, note: string): ScoreItem {
  return { key, label, score, max, band: bandValue, note };
}

function band(score: number, max: number): ScoreBand {
  const ratio = score / Math.max(1, max);
  if (ratio <= 0) return "Missing";
  if (ratio < 0.45) return "Developing";
  if (ratio < 0.85) return "Ready";
  return "Strong";
}

function sumScore(items: ScoreItem[]) {
  const total = items.reduce((sum, item) => sum + item.score, 0);
  const max = items.reduce((sum, item) => sum + item.max, 0);
  return Math.round((total / Math.max(1, max)) * 100);
}

function originalStartingPoint(report: OpportunityReport) {
  return report.input?.existingIdea?.trim() || report.input?.targetAudience?.trim() || report.input?.interests?.trim() || null;
}

function constraintSentence(report: OpportunityReport) {
  const input = report.input;
  if (!input) return "Original founder constraints are unavailable for this legacy project.";
  return `${input.timePerWeek} hours/week, $${input.budget} budget, risk tolerance ${input.riskTolerance}/10, goal: ${GOAL_LABELS[input.goal]}.`;
}

function inferTechnicalAbility(skills: string) {
  if (/\b(coding|programming|engineering|developer|typescript|react|python|sql)\b/i.test(skills)) return "technical";
  if (/\b(design|research|writing|sales|marketing)\b/i.test(skills)) return "non-technical or mixed";
  return "not specified";
}

function hasSpecificText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (text.length < 8) return false;
  return !detectPlaceholderAnswer(text, "generic").isPlaceholder;
}

function cleanOptional(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

function source(type: ValueProofSourceType, label: string, id?: string, timestamp?: string): ValueProofSource {
  return { type, label, id, timestamp };
}

function itemText(title: string, detail: string, itemSource: ValueProofSource): ValueProofTextItem {
  return { title, detail, source: itemSource };
}

function labelForEvent(eventName: string) {
  if (eventName === "project_database_save_completed") return "Project saved";
  if (eventName === "first_evidence_saved") return "First evidence saved";
  return "Project creation completed";
}

function dedupeTimeline(items: Array<{ date: string; label: string; detail: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.date}-${item.label}-${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
