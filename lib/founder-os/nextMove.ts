import type { ProjectDecision, ProjectValidationExperiment } from "@/lib/database.types";
import { cleanGeneratedCopy } from "@/lib/founder-os/copyQuality";
import { createProjectContext } from "@/lib/founder-os/projectContext";
import { buildExecutionSupport, type ExecutionSupport } from "@/lib/founder-os/executionSupport";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { hasRecordedOutcome, type ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";
import type { ProofSummary } from "@/lib/proof-board";

export type NextMoveActionType = "founder_action" | "ai_assisted" | "ai_executable";

export type NextMoveAssistance = {
  label: string;
  description: string;
  href: string;
  kind: "prepare" | "record" | "review";
};

export type NextMove = {
  title: string;
  exactAction: string;
  why: string;
  doneWhen: string;
  evidenceToRecord: string;
  expectedOutcome: string;
  effort: string;
  actionType: NextMoveActionType;
  primaryHref: string;
  primaryLabel: string;
  uncertainty: string;
  evidenceState: string;
  constraintNote: string | null;
  whatChanged: string;
  assistance: NextMoveAssistance[];
  support: ExecutionSupport;
  routeKey: ValidationRoutingResult["pathType"];
};

export function buildNextMove({
  projectId,
  report,
  status,
  proof,
  route,
  experiments = [],
  decisions = [],
}: {
  projectId: string;
  report: OpportunityReport;
  status: ProjectStatus;
  proof: ProofSummary;
  route: ValidationRoutingResult;
  experiments?: ProjectValidationExperiment[];
  decisions?: ProjectDecision[];
}): NextMove {
  const context = createProjectContext({ report, status, proof });
  const action = route.firstAction;
  const assistance = assistanceForRoute(projectId, route.pathType);
  const support = buildExecutionSupport({ report, status, proof, route, experiments });
  const actionType: NextMoveActionType = route.pathType === "private_research"
    ? "ai_executable"
    : ["customer_discovery", "service_pilot", "content_test"].includes(route.pathType)
      ? "ai_assisted"
      : "founder_action";

  return {
    title: cleanGeneratedCopy(action.action, { heading: true }),
    exactAction: cleanGeneratedCopy(action.action),
    why: cleanGeneratedCopy([action.why, ...route.decision.factors].join(" ")),
    doneWhen: cleanGeneratedCopy(action.doneWhen),
    evidenceToRecord: cleanGeneratedCopy(action.evidenceToRecord),
    expectedOutcome: cleanGeneratedCopy(action.afterCompletion),
    effort: action.estimatedTime,
    actionType,
    primaryHref: `/projects/${projectId}?section=validate#execution-support`,
    primaryLabel: "Help me do it",
    uncertainty: cleanGeneratedCopy(route.targetAssumption),
    evidenceState: evidenceState(proof),
    constraintNote: founderConstraintNote(context.founder),
    whatChanged: latestMaterialChange(experiments, decisions, proof),
    assistance,
    support,
    routeKey: route.pathType,
  };
}

export function evidenceState(proof: ProofSummary) {
  if (proof.preorders_or_revenue_cents > 0) return "Revenue recorded";
  if (proof.payment_intent > 0) return `${proof.payment_intent} payment-intent signal${proof.payment_intent === 1 ? "" : "s"} recorded`;
  if (proof.waitlist_signups > 0 || proof.interested_users > 0) {
    const commitments = proof.waitlist_signups + proof.interested_users;
    return `${commitments} interest or signup signal${commitments === 1 ? "" : "s"} recorded`;
  }
  if (proof.replies > 0 || proof.pain_confirmed > 0) {
    return `${proof.replies} repl${proof.replies === 1 ? "y" : "ies"} and ${proof.pain_confirmed} problem signal${proof.pain_confirmed === 1 ? "" : "s"} recorded`;
  }
  if (proof.people_contacted > 0) return `${proof.people_contacted} people contacted; no response outcome recorded yet`;
  return "No external evidence recorded yet";
}

function assistanceForRoute(projectId: string, route: ValidationRoutingResult["pathType"]): NextMoveAssistance[] {
  const validate = `/projects/${projectId}?section=validate`;
  const project = `/projects/${projectId}?section=project`;
  const launch = `/projects/${projectId}?section=launch`;
  const sharedRecord: NextMoveAssistance = {
    label: "Record what happened",
    description: "Save the factual result so the recommendation can change.",
    href: `${validate}#proof-board`,
    kind: "record",
  };

  const map: Partial<Record<ValidationRoutingResult["pathType"], NextMoveAssistance[]>> = {
    project_clarification: [
      { label: "Tighten the project brief", description: "Clarify the audience, problem, and smallest useful version.", href: project, kind: "prepare" },
      sharedRecord,
    ],
    private_research: [
      { label: "Prepare the research", description: "Open the guided validation workspace and choose what to investigate.", href: `${validate}#validation-path`, kind: "prepare" },
      sharedRecord,
    ],
    customer_discovery: [
      { label: "Draft outreach and questions", description: "Use the project-specific outreach kit to start the conversations.", href: `${validate}#outreach-kit`, kind: "prepare" },
      sharedRecord,
    ],
    prototype_test: [
      { label: "Define the smallest prototype", description: "Use the project scope before making anything larger.", href: project, kind: "prepare" },
      sharedRecord,
    ],
    landing_page_test: [
      { label: "Prepare the test", description: "Open the validation path and define the action and success condition.", href: `${validate}#validation-path`, kind: "prepare" },
      sharedRecord,
    ],
    waitlist_test: [
      { label: "Prepare the offer", description: "Use the launch support to make the commitment request concrete.", href: launch, kind: "prepare" },
      sharedRecord,
    ],
    service_pilot: [
      { label: "Draft the pilot offer", description: "Use the outreach kit to contact qualified prospects.", href: `${validate}#outreach-kit`, kind: "prepare" },
      sharedRecord,
    ],
    pricing_test: [
      { label: "Design the price test", description: "Open the active path and define the offer and factual outcome.", href: `${validate}#validation-path`, kind: "prepare" },
      sharedRecord,
    ],
    content_test: [
      { label: "Prepare one message", description: "Use the saved project language to create one narrow test.", href: `${validate}#outreach-kit`, kind: "prepare" },
      sharedRecord,
    ],
    launch_readiness: [
      { label: "Check the core flow", description: "Work through factual launch blockers and the smallest complete flow.", href: `${launch}#launch-command-center`, kind: "prepare" },
      sharedRecord,
    ],
    post_launch_learning: [
      { label: "Review the outcome", description: "Compare early usage and feedback with the intended result.", href: `${validate}#proof-board`, kind: "review" },
      sharedRecord,
    ],
  };

  return map[route] ?? [
    { label: "Open guided support", description: "Use the active validation path for this project.", href: `${validate}#validation-path`, kind: "prepare" },
    sharedRecord,
  ];
}

function latestMaterialChange(experiments: ProjectValidationExperiment[], decisions: ProjectDecision[], proof: ProofSummary) {
  const latestDecision = [...decisions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestExperiment = [...experiments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  if (latestDecision) return cleanGeneratedCopy(`Decision recorded: ${latestDecision.rationale}`);
  if (latestExperiment && hasRecordedOutcome(latestExperiment)) {
    const detail = latestExperiment.learnings?.trim() || experimentResult(latestExperiment);
    return cleanGeneratedCopy(`${latestExperiment.title}: ${detail}`);
  }
  if (proof.people_contacted > 0) return evidenceState(proof);
  return "Nothing material has changed yet. The recommendation is based on the project definition and founder constraints, not invented evidence.";
}

function experimentResult(experiment: ProjectValidationExperiment) {
  const signals = [
    experiment.replies ? `${experiment.replies} replies` : null,
    experiment.pain_confirmed ? `${experiment.pain_confirmed} problem signals` : null,
    experiment.waitlist_signups ? `${experiment.waitlist_signups} signups` : null,
    experiment.payment_intent ? `${experiment.payment_intent} payment-intent signals` : null,
    experiment.preorders_or_revenue_cents > 0 ? "revenue recorded" : null,
  ].filter(Boolean);
  return signals.length ? signals.join(", ") : "an outcome was recorded without a positive signal";
}

function founderConstraintNote(founder: ReturnType<typeof createProjectContext>["founder"]) {
  const notes: string[] = [];
  if (founder.hoursPerWeek <= 5) notes.push(`scoped for ${founder.hoursPerWeek} hours per week`);
  if (founder.budget <= 100) notes.push(`keeps spending within the recorded $${founder.budget} budget`);
  if (founder.technicalAbility === "low") notes.push("does not require custom code");
  return notes.length ? `This move ${joinNatural(notes)}.` : null;
}

function joinNatural(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
