import type { ProjectOutput, ProjectValidationExperiment } from "@/lib/database.types";
import { createProjectContext, type ProjectContext, type ProjectType } from "@/lib/founder-os/projectContext";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";

export const VALIDATION_PATH_TYPES = [
  "project_clarification", "private_research", "customer_discovery", "prototype_test",
  "landing_page_test", "waitlist_test", "service_pilot", "pricing_test", "content_test",
  "marketplace_supply_test", "marketplace_demand_test", "physical_product_test",
  "launch_readiness", "post_launch_learning",
] as const;
export type ValidationPathType = (typeof VALIDATION_PATH_TYPES)[number];

export const FOUNDER_VALIDATION_PREFERENCES = [
  "ready_to_talk", "private_research_first", "clarify_idea", "need_something_concrete",
  "test_demand_without_building", "test_pricing", "prepare_to_launch",
] as const;
export type FounderValidationPreference = (typeof FOUNDER_VALIDATION_PREFERENCES)[number];

export const FOUNDER_VALIDATION_PREFERENCE_OPTIONS: Array<{ value: FounderValidationPreference; label: string }> = [
  { value: "ready_to_talk", label: "I am ready to talk to potential users." },
  { value: "private_research_first", label: "I prefer private research first." },
  { value: "clarify_idea", label: "I need to clarify the idea." },
  { value: "need_something_concrete", label: "I need something concrete to show." },
  { value: "test_demand_without_building", label: "I want to test demand without building." },
  { value: "test_pricing", label: "I want to test pricing." },
  { value: "prepare_to_launch", label: "I am preparing to launch." },
];

export const VALIDATION_EVIDENCE_TYPES = [
  "problem_interview", "research_pattern", "prototype_feedback", "landing_page_result", "waitlist_signup",
  "service_pilot_response", "pricing_response", "payment_intent", "content_response",
  "marketplace_supply_response", "marketplace_demand_response", "physical_product_feedback",
  "launch_check", "post_launch_feedback", "other",
] as const;
export type ValidationEvidenceType = (typeof VALIDATION_EVIDENCE_TYPES)[number];

export type AssumptionType = "problem_exists" | "problem_priority" | "audience_reachable" | "solution_useful" | "behavior_change" | "willingness_to_pay" | "delivery_feasible" | "supply_exists" | "demand_exists" | "manufacturing_feasible" | "content_resonates" | "launch_reliable" | "retention";
export type ValidationPathHistoryInput = { path_type: ValidationPathType; status: "recommended" | "active" | "completed" | "replaced" | "paused" | "blocked"; source?: string; created_at?: string };
export type ValidationAction = { action: string; why: string; doneWhen: string; evidenceToRecord: string; afterCompletion: string; href: string; estimatedTime: string };
export type ValidationPathAlternative = { pathType: ValidationPathType; title: string; whyItMightFit: string; tradeoff: string; evidenceProduced: string };
export type ValidationBlocker = { id: string; label: string; source: "project_context" | "proof_board" | "validation_path" | "project_stage" | "founder_constraints"; resolutionCondition: string; href: string };

export type ValidationRoutingInput = {
  report: OpportunityReport;
  status: ProjectStatus;
  proof?: ProofSummary | null;
  preference?: FounderValidationPreference | null;
  experiments?: Array<Partial<ProjectValidationExperiment>>;
  outputs?: Array<Pick<ProjectOutput, "output_type">>;
  pathHistory?: ValidationPathHistoryInput[];
  forcedPath?: ValidationPathType;
};

export type ValidationRoutingResult = {
  key: ValidationPathType;
  pathType: ValidationPathType;
  title: string;
  readiness: string;
  confidence: "clear_fit" | "reasonable_fit" | "needs_more_context";
  targetAssumptionKey: AssumptionType;
  targetAssumption: string;
  targetEvidenceType: ValidationEvidenceType;
  rationale: string;
  successCondition: string;
  completionRequirement: string;
  nextPathHint: ValidationPathType;
  firstAction: ValidationAction;
  alternatives: ValidationPathAlternative[];
  progress: number;
  complete: boolean;
  avoidanceGuard: string | null;
  suggestedStage: ProjectStatus;
  blockers: ValidationBlocker[];
  starterExperiment: { title: string; goal: string; channel: "DMs" | "interviews" | "survey" | "landing page" | "TikTok" | "Reddit" | "school" | "email" | "other"; hypothesis: string; taskDescription: string; evidenceType: ValidationEvidenceType };
  // Compatibility fields for existing UI while the richer model is adopted.
  action: string;
  why: string;
  href: string;
};

export function routeValidationPath(input: ValidationRoutingInput): ValidationRoutingResult {
  const proof = input.proof ?? emptyProof();
  const context = createProjectContext({ report: input.report, status: input.status, proof });
  const state = assessState(input, context, proof);
  const recommended = input.forcedPath ?? choosePath(input, context, state);
  const path = describePath(recommended, context, state);
  const alternatives = alternativeTypes(recommended, context, state)
    .map((pathType) => describeAlternative(pathType, context, state))
    .slice(0, 2);
  const completion = pathCompletion(recommended, state);
  const avoidanceGuard = avoidanceMessage(input, state);
  const suggestedStage = suggestProjectStage(input.status, state);
  const blockers = deriveValidationBlockers(context, state, recommended);
  return {
    key: recommended,
    pathType: recommended,
    ...path,
    alternatives,
    progress: completion.progress,
    complete: completion.complete,
    avoidanceGuard,
    suggestedStage,
    blockers,
    action: path.firstAction.action,
    why: path.rationale,
    href: path.firstAction.href,
  };
}

export function selectValidationPath(input: Pick<ValidationRoutingInput, "report" | "status" | "proof" | "preference" | "experiments" | "outputs" | "pathHistory">) {
  return routeValidationPath(input);
}

function choosePath(input: ValidationRoutingInput, context: ProjectContext, state: RoutingState): ValidationPathType {
  if (!state.clearAudience || !state.clearProblem || !state.hasMvp) return "project_clarification";
  if (input.status === "launched") return "post_launch_learning";
  if (state.repeatedPreparation && !state.hasExternalEvidence) return externalPathFor(context.projectType, state);
  if (context.projectType === "Marketplace") return state.hasSupplyEvidence ? "marketplace_demand_test" : "marketplace_supply_test";
  if (isPhysical(context.projectType) && !state.hasPhysicalFeedback) return "physical_product_test";
  if (isService(context.projectType) && !state.hasPilotEvidence) {
    if (input.preference === "private_research_first" && state.privateResearchCount < 1) return "private_research";
    return "service_pilot";
  }
  if (isCreator(context.projectType) && !state.hasContentEvidence) return "content_test";

  if (input.preference === "clarify_idea" && state.clarificationCount < 1) return "project_clarification";
  if (input.preference === "private_research_first" && state.privateResearchCount < 2 && !state.hasExternalEvidence) return "private_research";
  if (input.preference === "ready_to_talk" && !state.problemSupported) return "customer_discovery";
  if (input.preference === "need_something_concrete" && !state.solutionFeedback) return "prototype_test";
  if (input.preference === "test_demand_without_building" && !state.demandSignal) return state.hasLandingArtifact ? "landing_page_test" : "waitlist_test";
  if (input.preference === "test_pricing" && state.problemSupported) return "pricing_test";
  if (input.preference === "prepare_to_launch" && state.problemSupported && state.demandSignal) return "launch_readiness";

  if (!state.hasExternalEvidence) return state.privateResearchCount < 1 && context.founder.riskTolerance <= 5 ? "private_research" : "customer_discovery";
  if (!state.problemSupported) return "customer_discovery";
  if (!state.solutionFeedback && input.status === "building") return "prototype_test";
  if (!state.demandSignal) return state.hasLandingArtifact ? "landing_page_test" : "waitlist_test";
  if (!state.pricingSignal) return "pricing_test";
  return input.status === "building" ? "launch_readiness" : "prototype_test";
}

type PathDescription = {
  title: string;
  readiness: string;
  confidence: "clear_fit" | "reasonable_fit" | "needs_more_context";
  targetAssumptionKey: AssumptionType;
  targetAssumption: string;
  targetEvidenceType: ValidationEvidenceType;
  rationale: string;
  successCondition: string;
  completionRequirement: string;
  nextPathHint: ValidationPathType;
  firstAction: ValidationAction;
  starterExperiment: ValidationRoutingResult["starterExperiment"];
};

function describePath(pathType: ValidationPathType, context: ProjectContext, state: RoutingState): PathDescription {
  const user = context.language.userNoun;
  const product = context.language.productNoun;
  const problem = context.problem;
  const configs: Record<ValidationPathType, Omit<ValidationRoutingResult, "key" | "pathType" | "alternatives" | "progress" | "complete" | "avoidanceGuard" | "suggestedStage" | "blockers" | "action" | "why" | "href">> = {
    project_clarification: pathConfig("Clarify the Project", "Needs a clearer problem first", "problem_exists", `Whether ${context.audience} experience one specific, recognizable problem.`, "other", "The audience, problem, or smallest test is not yet specific enough for useful evidence.", "The audience, problem, desired outcome, and smallest test are stated plainly.", "Record the missing project fundamentals and choose one primary assumption.", state.clearProblem ? "private_research" : "customer_discovery", action("Write one sentence naming the specific audience, painful moment, and desired outcome.", "Clear language prevents wasted research and awkward tests.", "A stranger could identify who the project is for and what painful moment it addresses.", "No external evidence yet; save the clarified assumption.", "Move to one short research or external test.", "?section=project", "15-25 minutes"), starter("Clarify the main assumption", "Separate the problem from the proposed solution.", "other", `The intended ${user} experience ${problem}.`, "Write the audience, painful moment, desired outcome, and one assumption to test.", "other")),
    private_research: pathConfig("Review Existing Alternatives", "Private preparation before an external test", "problem_exists", `Repeated public examples of ${user} dealing with ${problem}.`, "research_pattern", "A short private research step fits because it can sharpen user language without forcing public outreach today.", "At least three sources and one repeated pattern or contradiction are recorded with a next decision.", "Save source references, the repeated language, and what question remains unresolved.", "customer_discovery", action("Review three public discussions, reviews, or workflows and record one repeated problem pattern.", "This makes later questions more specific while keeping the first step private.", "Three source references and one repeated pattern or contradiction are saved.", "Research pattern, source type, and the unresolved question.", "Move to a customer, prototype, pilot, or demand test.", "?section=validate#proof-board", "30-45 minutes"), starter("Private research pattern review", "Understand existing behavior before asking people directly.", "other", `Public discussions will show repeated language about ${problem}.`, "Review three sources, record references, and summarize one repeated pattern or contradiction.", "research_pattern")),
    customer_discovery: pathConfig("Talk to Potential Users", "Ready to gather problem evidence", "problem_priority", `Whether ${user} experience the problem often enough to act.`, "problem_interview", `The audience and problem are clear enough to ask useful questions of real ${user}.`, `Record ${state.contactTarget} relevant conversations or replies, one repeated learning, and a decision.`, "Save contact count, concise learning, repeated pattern, and next decision in Proof Board.", "prototype_test", action(`Ask ${state.contactTarget} ${user} how they handle ${lower(problem)} today.`, "Current behavior and repeated pain are more useful than compliments about the idea.", `${state.contactTarget} relevant contacts or conversations and one repeated learning are recorded.`, "Problem interview, quote or pattern, and contradictions.", "Decide whether to narrow, prototype, pause, or test demand.", "?section=validate#proof-board", state.contactTarget <= 3 ? "45-90 minutes" : "1-2 hours this week"), starter("Problem discovery conversations", "Learn how the intended audience handles the problem today.", "interviews", `${context.audience} experience ${problem} often enough to seek a better approach.`, `Ask ${state.contactTarget} ${user} about current behavior before describing the solution.`, "problem_interview")),
    prototype_test: pathConfig("Test a Prototype", "Something concrete would improve feedback", "solution_useful", `Whether the smallest ${product} workflow is understandable and useful.`, "prototype_feedback", `The problem is clear enough, and a tiny ${product} can produce more concrete feedback than another abstract explanation.`, "A smallest artifact reference and at least one external reaction with a learning are recorded.", "Define one workflow, show only that artifact, and record reactions before building further.", "waitlist_test", action(`Create one tiny ${product} example that shows only the core before-and-after workflow.`, "A narrow artifact tests usefulness without turning validation into weeks of building.", "One artifact reference and at least one external reaction are recorded.", "Prototype feedback, confusing points, useful points, and the resulting decision.", "Revise once or move to a commitment test.", "?section=validate#proof-board", context.founder.technicalAbility === "high" ? "1-3 hours" : "45-90 minutes"), starter("Smallest prototype reaction test", "Test one core workflow, not a complete product.", "interviews", `${user} will understand and value the core ${product} workflow.`, "Create or reference one tiny artifact, show it to at least one relevant person, and record the reaction.", "prototype_feedback")),
    landing_page_test: pathConfig("Test a Landing Page", "Ready to test message and action", "demand_exists", `Whether a clear message leads ${user} to take a defined action.`, "landing_page_result", "The audience and problem are clear enough to test messaging without building the full product.", "The page, traffic source, visits, meaningful action, results, and limitations are recorded.", "Publish one focused page, define one conversion action, and record factual results.", "waitlist_test", action("Publish one focused landing page with one measurable action.", "This tests message clarity and action without treating page views as demand.", "Traffic source, visits, conversion action, results, and limitations are recorded.", "Landing-page result and factual conversion count.", "Revise the message or move to a stronger commitment test.", "?section=validate#proof-board", "1-2 hours"), starter("Landing page message test", "Test whether the message produces a meaningful action.", "landing page", `${context.audience} will understand the value and take the selected action.`, "Publish one page, record its traffic source, visits, meaningful actions, and limitations.", "landing_page_result")),
    waitlist_test: pathConfig("Build a Waitlist", "Ready to test a small commitment", "behavior_change", `Whether interested ${user} will provide contact information or request access.`, "waitlist_signup", "A waitlist can test commitment without requiring a finished product.", "The signup source and at least one relevant signup or a documented zero-result test are recorded.", "Offer a clearly described beta or waitlist and record source, reach, signups, and limitations.", "pricing_test", action(`Invite a small group of ${user} to a clearly described waitlist or beta.`, "A signup is stronger than a compliment, while a zero result is still useful evidence.", "Source, number invited or reached, signups, and lesson are recorded.", "Waitlist signup or factual zero-result outcome.", "Test pricing, revise the offer, or narrow the audience.", "?section=validate#proof-board", "45-90 minutes"), starter("Waitlist commitment test", "Test whether interested people take a small next step.", "landing page", `${user} who recognize the problem will request access.`, "Share a clear signup or beta invite, then record source, reach, signups, and limitations.", "waitlist_signup")),
    service_pilot: pathConfig("Offer a Paid Pilot", "A manual pilot is the cheapest useful test", "willingness_to_pay", `Whether qualified ${user} will discuss or accept a narrow service outcome.`, "service_pilot_response", `A service pilot fits this ${context.projectType.toLowerCase()} better than software development and respects the founder's time and budget.`, "The offer, prospect response, objections, delivery result where applicable, and payment classification are recorded.", "Define one narrow outcome, present it to qualified prospects, and separate offer creation from actual response.", "pricing_test", action(`Write one narrow pilot offer and present it to ${state.contactTarget} qualified ${user}.`, "A response to a real offer tests demand faster than building internal tools.", "The offer and real prospect responses are recorded; drafting alone is not completion.", "Pilot response, objection, acceptance, delivery result, or payment.", "Refine, deliver, price, or pause based on the response.", "?section=validate#proof-board", "1-3 hours this week"), starter("Narrow service pilot", "Test a real offer with qualified prospects.", "email", `Qualified ${user} will respond to a narrow offer addressing ${problem}.`, `Define the outcome, scope, and pilot terms, then present it to ${state.contactTarget} qualified prospects and record responses.`, "service_pilot_response")),
    pricing_test: pathConfig("Test Pricing", "Problem evidence exists; willingness to pay is unresolved", "willingness_to_pay", `Whether relevant ${user} show stated, intentional, or actual willingness to pay.`, "pricing_response", "Pricing is now a higher-risk unknown than basic problem clarity.", "The price hypothesis, method, response classification, result, and decision are recorded.", "Test one price using a conversation, pilot, preorder, deposit, or checkout method; classify the result honestly.", "launch_readiness", action("Test one explicit price with people who already understand the problem or offer.", "This separates general interest from willingness to pay.", "The price, method, response, evidence class, and resulting decision are recorded.", "Stated interest, payment intent, or actual payment—kept separate.", "Revise pricing, improve the offer, or prepare a small launch.", "?section=validate#proof-board", "30-60 minutes"), starter("Pricing response test", "Separate interest from real willingness to pay.", "interviews", `${user} who understand the value will respond meaningfully to one price hypothesis.`, "Present one price using a defined method and classify the response as interest, intent, or payment.", "pricing_response")),
    content_test: pathConfig("Test Content", "Audience response is the next useful signal", "content_resonates", `Whether a focused topic attracts qualified response from the intended ${user}.`, "content_response", "A small content test fits an audience-first or creator project better than generic software validation.", "The intended audience, content item, meaningful response metric, lesson, and decision are recorded.", "Publish one focused test and track replies, saves, signups, or qualified conversations—not impressions alone.", "waitlist_test", action("Publish one focused content test built around the audience's painful moment.", "Qualified response tests whether the topic and audience fit before building a larger content system.", "The intended audience and at least one meaningful response metric are recorded.", "Replies, saves, signups, or qualified conversations plus the lesson.", "Repeat the stronger angle or add a conversion test.", "?section=validate#proof-board", "45-90 minutes"), starter("Focused content response test", "Test one pain-point angle with the intended audience.", "TikTok", `A focused message about ${problem} will produce qualified response from ${user}.`, "Publish one content item and record audience, replies, saves, signups, or qualified conversations plus the lesson.", "content_response")),
    marketplace_supply_test: pathConfig("Validate Supply", "The provider side must work before claiming a marketplace", "supply_exists", "Whether relevant providers will participate and what they require.", "marketplace_supply_response", "A marketplace needs separate proof from each side; supply is the first unresolved side here.", "Provider responses, participation conditions, onboarding friction, and one decision are recorded.", "Speak with or observe potential providers and record incentives, objections, and required information.", "marketplace_demand_test", action(`Ask ${state.contactTarget} potential providers what would make participation worthwhile.`, "Without usable supply, buyer demand cannot produce a working marketplace.", "Provider responses and participation conditions are recorded.", "Supply response, incentive, onboarding friction, and contradictions.", "Test demand only after documenting the supply constraint.", "?section=validate#proof-board", "1-2 hours this week"), starter("Marketplace supply test", "Learn whether providers will participate and under what conditions.", "interviews", "Potential providers will participate if the incentive and onboarding are clear.", "Ask potential providers about incentives, objections, required information, and onboarding friction.", "marketplace_supply_response")),
    marketplace_demand_test: pathConfig("Validate Demand", "Supply has a path; buyer behavior is unresolved", "demand_exists", "Whether buyers seek the transaction and will complete the next step.", "marketplace_demand_response", "Marketplace demand must be tested separately from provider interest.", "Buyer behavior, current alternative, transaction friction, and a meaningful next action are recorded.", "Test one buyer workflow without claiming the supply side is also validated.", "pricing_test", action(`Ask ${state.contactTarget} potential buyers to try or react to one transaction workflow.`, "Buyer interest and transaction friction are separate from supply participation.", "Buyer reactions and the intended transaction action are recorded.", "Demand response, current alternative, friction, and commitment.", "Choose which side needs another test or test the transaction economics.", "?section=validate#proof-board", "1-2 hours this week"), starter("Marketplace demand test", "Test buyer behavior separately from supply.", "interviews", "Potential buyers will seek and attempt the proposed transaction.", "Test one buyer workflow and record current alternatives, friction, and meaningful action.", "marketplace_demand_response")),
    physical_product_test: pathConfig("Test a Physical Prototype", "Desirability and feasibility need physical-product evidence", "manufacturing_feasible", "Whether buyers value the item and whether a practical version can be produced.", "physical_product_feedback", "A sketch, mockup, rough sample, or cost conversation is more relevant than software-specific advice.", "A mockup or sample reference, user reaction, approximate cost or feasibility note, and decision are recorded.", "Test desirability, usability, cost, and purchase intent as separate assumptions.", "pricing_test", action("Create the cheapest useful sketch, mockup, or rough sample and test one risky assumption.", "This avoids manufacturing before desirability and feasibility are understood.", "The artifact, reaction, feasibility or cost note, and next decision are recorded.", "Physical feedback, handling observation, unit-cost note, or purchase intent.", "Revise the prototype, estimate cost, test price, or pause.", "?section=validate#proof-board", "1-3 hours"), starter("Physical product reaction test", "Test one physical-product risk before manufacturing.", "interviews", `${user} will understand and value the rough product concept.`, "Show a sketch, mockup, or sample and separately record desirability, usability, feasibility, cost, and purchase intent.", "physical_product_feedback")),
    launch_readiness: pathConfig("Prepare to Launch", "Evidence exists; real launch blockers are next", "launch_reliable", `Whether the smallest ${context.language.releaseNoun} works reliably for initial users.`, "launch_check", "The project has enough evidence to focus on specific reliability and first-user blockers.", "The core flow, account or delivery path, feedback route, and first acquisition step are checked with factual results.", "Resolve the highest real blocker and record the test result; checklist clicks alone are not evidence.", "post_launch_learning", action(`Test the complete core ${context.language.releaseNoun} flow once as a real user.`, "A small launch only helps if the core experience works and feedback can be collected.", "The core flow result and any launch-blocking failure are recorded.", "Launch check, failure or success, and resolution decision.", "Invite a small group only after the blocker is resolved.", "?section=launch#launch-command-center", "45-90 minutes"), starter("Core launch-flow check", "Test the smallest complete user or delivery flow.", "other", `The core ${context.language.releaseNoun} flow can be completed without a launch-blocking failure.`, "Run the complete core flow, record the result, and capture any real blocker and resolution.", "launch_check")),
    post_launch_learning: pathConfig("Learn From Early Users", "The project is launched; activation and retention matter now", "retention", `Whether early ${user} activate, return, and receive the intended value.`, "post_launch_feedback", "Pre-launch tasks are no longer the main priority; the next useful evidence is actual usage and feedback.", "Activation or delivery result, repeat behavior, feedback, and one improvement decision are recorded.", "Review one early-user outcome and choose one retention or reliability improvement.", "post_launch_learning", action(`Review how the first ${user} reached—or failed to reach—the core outcome.`, "Early usage and support evidence should now guide changes.", "One activation or delivery result and one evidence-based improvement decision are recorded.", "Activation, usage, repeat behavior, support issue, or retention feedback.", "Improve one bottleneck and measure again.", "?section=validate#proof-board", "30-60 minutes"), starter("Early-user learning review", "Learn from activation, repeat behavior, and support evidence.", "interviews", `${user} can reach the intended outcome and have a reason to return.`, "Review one early-user outcome, record friction or success, and choose one improvement.", "post_launch_feedback")),
  };
  return configs[pathType];
}

function pathConfig(title: string, readiness: string, targetAssumptionKey: AssumptionType, targetAssumption: string, targetEvidenceType: ValidationEvidenceType, rationale: string, successCondition: string, completionRequirement: string, nextPathHint: ValidationPathType, firstAction: ValidationAction, starterExperiment: ValidationRoutingResult["starterExperiment"]): PathDescription {
  return { title, readiness, confidence: title === "Clarify the Project" ? "needs_more_context" : "clear_fit", targetAssumptionKey, targetAssumption, targetEvidenceType, rationale, successCondition, completionRequirement, nextPathHint, firstAction, starterExperiment };
}
function action(actionText: string, why: string, doneWhen: string, evidenceToRecord: string, afterCompletion: string, href: string, estimatedTime: string): ValidationAction { return { action: actionText, why, doneWhen, evidenceToRecord, afterCompletion, href, estimatedTime }; }
function starter(title: string, goal: string, channel: ValidationRoutingResult["starterExperiment"]["channel"], hypothesis: string, taskDescription: string, evidenceType: ValidationEvidenceType) { return { title, goal, channel, hypothesis, taskDescription, evidenceType }; }

type RoutingState = ReturnType<typeof assessState>;
function assessState(input: ValidationRoutingInput, context: ProjectContext, proof: ProofSummary) {
  const experiments = input.experiments ?? [];
  const evidenceTypes = new Set(experiments.map((row) => row.evidence_type).filter(Boolean));
  const completedTypes = new Set(experiments.filter((row) => row.status === "completed" && hasText(row.learnings)).map((row) => row.evidence_type).filter(Boolean));
  const history = input.pathHistory ?? [];
  const completedPrep = history.filter((row) => row.status === "completed" && ["project_clarification", "private_research", "prototype_test"].includes(row.path_type)).length;
  const hasExternalEvidence = proof.people_contacted > 0 || proof.replies > 0 || proof.pain_confirmed > 0 || proof.interested_users > 0 || proof.waitlist_signups > 0 || proof.payment_intent > 0 || proof.preorders_or_revenue_cents > 0 || [...evidenceTypes].some((value) => value && value !== "research_pattern" && value !== "other");
  const contactTarget = context.founder.hoursPerWeek <= 5 || context.founder.riskTolerance <= 3 ? 3 : isService(context.projectType) ? 3 : 5;
  return {
    clearAudience: hasSpecificText(input.report.summary?.targetCustomer), clearProblem: hasSpecificText(input.report.summary?.painPoint),
    hasMvp: hasAnyText(input.report.mvpPlan?.mustHaveFeatures) || hasAnyText(input.report.mvpPlan?.featureList),
    hasExternalEvidence, problemSupported: proof.pain_confirmed >= Math.min(3, contactTarget) || (proof.replies >= 3 && proof.pain_confirmed >= 1),
    solutionFeedback: evidenceTypes.has("prototype_feedback") || completedTypes.has("physical_product_feedback"),
    demandSignal: proof.interested_users > 0 || proof.waitlist_signups > 0 || evidenceTypes.has("landing_page_result") || evidenceTypes.has("content_response"),
    pricingSignal: proof.payment_intent > 0 || proof.preorders_or_revenue_cents > 0 || evidenceTypes.has("pricing_response"),
    hasSupplyEvidence: evidenceTypes.has("marketplace_supply_response"), hasDemandEvidence: evidenceTypes.has("marketplace_demand_response"),
    hasPhysicalFeedback: evidenceTypes.has("physical_product_feedback"), hasPilotEvidence: evidenceTypes.has("service_pilot_response"), hasContentEvidence: evidenceTypes.has("content_response"),
    hasLandingArtifact: (input.outputs ?? []).some((row) => row.output_type === "landing_page_copy") || evidenceTypes.has("landing_page_result"),
    contradictory: proof.replies >= 3 && proof.pain_confirmed === 0,
    privateResearchCount: history.filter((row) => row.path_type === "private_research" && row.status === "completed").length,
    clarificationCount: history.filter((row) => row.path_type === "project_clarification" && row.status === "completed").length,
    repeatedPreparation: completedPrep >= 3,
    contactTarget, proof, experiments, evidenceTypes, completedTypes,
  };
}

function pathCompletion(pathType: ValidationPathType, state: RoutingState) {
  const completedEvidence = (type: ValidationEvidenceType) => state.completedTypes.has(type);
  const values: Record<ValidationPathType, number> = {
    project_clarification: [state.clearAudience, state.clearProblem, state.hasMvp].filter(Boolean).length / 3,
    private_research: completedEvidence("research_pattern") ? 1 : state.evidenceTypes.has("research_pattern") ? 0.6 : 0,
    customer_discovery: Math.min(1, (state.proof.people_contacted / state.contactTarget) * 0.5 + (state.proof.pain_confirmed > 0 ? 0.3 : 0) + (state.experiments.some((row) => row.evidence_type === "problem_interview" && hasText(row.learnings)) ? 0.2 : 0)),
    prototype_test: completedEvidence("prototype_feedback") ? 1 : state.evidenceTypes.has("prototype_feedback") ? 0.6 : 0,
    landing_page_test: completedEvidence("landing_page_result") ? 1 : state.evidenceTypes.has("landing_page_result") ? 0.6 : 0,
    waitlist_test: state.proof.waitlist_signups > 0 ? 1 : state.evidenceTypes.has("waitlist_signup") ? 0.6 : 0,
    service_pilot: completedEvidence("service_pilot_response") || state.proof.payment_intent > 0 ? 1 : state.evidenceTypes.has("service_pilot_response") ? 0.6 : 0,
    pricing_test: state.pricingSignal ? 1 : 0,
    content_test: completedEvidence("content_response") ? 1 : state.evidenceTypes.has("content_response") ? 0.6 : 0,
    marketplace_supply_test: state.hasSupplyEvidence ? 1 : 0, marketplace_demand_test: state.hasDemandEvidence ? 1 : 0,
    physical_product_test: completedEvidence("physical_product_feedback") ? 1 : state.hasPhysicalFeedback ? 0.6 : 0,
    launch_readiness: state.completedTypes.has("launch_check") ? 1 : state.evidenceTypes.has("launch_check") ? 0.6 : 0,
    post_launch_learning: completedEvidence("post_launch_feedback") ? 1 : state.evidenceTypes.has("post_launch_feedback") ? 0.6 : 0,
  };
  const progress = Math.round(Math.max(0, Math.min(1, values[pathType])) * 100);
  return { progress, complete: progress >= 100 };
}

function alternativeTypes(current: ValidationPathType, context: ProjectContext, state: RoutingState): ValidationPathType[] {
  const candidates: ValidationPathType[] = isService(context.projectType) ? ["private_research", "customer_discovery", "service_pilot", "pricing_test"]
    : isCreator(context.projectType) ? ["private_research", "customer_discovery", "content_test", "waitlist_test"]
      : isPhysical(context.projectType) ? ["private_research", "customer_discovery", "physical_product_test", "pricing_test"]
        : context.projectType === "Marketplace" ? ["marketplace_supply_test", "marketplace_demand_test", "customer_discovery"]
          : ["private_research", "customer_discovery", "prototype_test", "landing_page_test", "waitlist_test"];
  return candidates.filter((item) => item !== current && prerequisitesAllow(item, state)).slice(0, 2);
}
function prerequisitesAllow(path: ValidationPathType, state: RoutingState) { if (!state.clearAudience || !state.clearProblem) return path === "project_clarification"; if (path === "pricing_test") return state.problemSupported; if (path === "launch_readiness") return state.problemSupported && state.demandSignal; return true; }
function describeAlternative(pathType: ValidationPathType, context: ProjectContext, state: RoutingState): ValidationPathAlternative { const path = describePath(pathType, context, state); return { pathType, title: path.title, whyItMightFit: path.rationale, tradeoff: alternativeTradeoff(pathType), evidenceProduced: path.firstAction.evidenceToRecord }; }
function alternativeTradeoff(pathType: ValidationPathType) { const tradeoffs: Partial<Record<ValidationPathType, string>> = { private_research: "Lower-pressure preparation, but it must lead to an external test after a small number of useful research steps.", customer_discovery: "Produces direct problem evidence, but requires reaching relevant people.", prototype_test: "Creates concrete feedback, but takes longer and can be wasted if the problem is unclear.", landing_page_test: "Tests messaging cheaply, but traffic and page views alone are not proof.", waitlist_test: "Tests a small commitment, but signups do not prove payment or retention.", service_pilot: "Can test demand and delivery quickly, but requires a narrow offer and qualified prospects.", content_test: "Fits audience-first projects, but impressions alone do not count.", pricing_test: "Tests willingness to pay, but only makes sense after the problem and offer are understandable." }; return tradeoffs[pathType] ?? "This path may fit, but it tests a different assumption and may delay the recommended evidence."; }

function deriveValidationBlockers(context: ProjectContext, state: RoutingState, pathType: ValidationPathType): ValidationBlocker[] {
  const blockers: ValidationBlocker[] = [];
  if (!state.clearAudience) blockers.push(blocker("audience", "The intended audience is unclear.", "project_context", "Save one specific audience.", "?section=project"));
  if (!state.clearProblem) blockers.push(blocker("problem", "The painful moment is unclear.", "project_context", "Save one recognizable problem statement.", "?section=project"));
  if (isService(context.projectType) && !state.hasPilotEvidence) blockers.push(blocker("pilot", "No qualified prospect has responded to a pilot offer.", "validation_path", "Record a real pilot response in Proof Board.", "?section=validate#proof-board"));
  else if (isPhysical(context.projectType) && !state.hasPhysicalFeedback) blockers.push(blocker("physical", "No buyer reaction or feasibility note is recorded for the physical concept.", "validation_path", "Record a mockup reaction and feasibility or cost note.", "?section=validate#proof-board"));
  else if (context.projectType === "Marketplace" && !state.hasSupplyEvidence) blockers.push(blocker("supply", "The provider side has not been tested.", "validation_path", "Record provider incentives, objections, and participation conditions.", "?section=validate#proof-board"));
  else if (isCreator(context.projectType) && !state.hasContentEvidence) blockers.push(blocker("content", "No qualified audience response is recorded.", "validation_path", "Record replies, saves, signups, or qualified conversations from one content test.", "?section=validate#proof-board"));
  else if (!state.hasExternalEvidence) blockers.push(blocker("evidence", `No external evidence from ${context.language.userNoun} is recorded.`, "proof_board", "Complete the active path and record the result.", "?section=validate#proof-board"));
  if (pathType === "launch_readiness" && !state.pricingSignal) blockers.push(blocker("price", "Willingness to pay is still unresolved.", "proof_board", "Record a pricing response, payment intent, or factual zero-result test.", "?section=validate#proof-board"));
  return blockers.slice(0, 3);
}
function blocker(id: string, label: string, source: ValidationBlocker["source"], resolutionCondition: string, href: string): ValidationBlocker { return { id, label, source, resolutionCondition, href }; }

function avoidanceMessage(input: ValidationRoutingInput, state: RoutingState) { if (state.repeatedPreparation && !state.hasExternalEvidence) return "You have completed several preparation steps. The next useful information now needs to come from outside the project."; if ((input.pathHistory ?? []).filter((row) => row.status === "replaced").length >= 2 && !state.hasExternalEvidence) return "Several paths have been changed without new evidence. PrismForge is keeping the next step small, but it still needs an external result."; return null; }
function suggestProjectStage(current: ProjectStatus, state: RoutingState): ProjectStatus { if (current === "launched") return "launched"; if (state.pricingSignal || state.solutionFeedback) return "building"; if (state.hasExternalEvidence) return "validating"; return "idea"; }
function externalPathFor(projectType: ProjectType, state: RoutingState): ValidationPathType { if (projectType === "Marketplace") return state.hasSupplyEvidence ? "marketplace_demand_test" : "marketplace_supply_test"; if (isService(projectType)) return "service_pilot"; if (isCreator(projectType)) return "content_test"; if (isPhysical(projectType)) return "physical_product_test"; return "customer_discovery"; }
function isService(type: ProjectType) { return ["Agency", "Consulting", "Local Business", "Coaching"].includes(type); }
function isCreator(type: ProjectType) { return ["Creator Business", "Content Brand"].includes(type); }
function isPhysical(type: ProjectType) { return ["Physical Product", "Hardware", "B2C Product"].includes(type); }
function hasSpecificText(value: unknown) { const text = String(value ?? "").trim().toLowerCase(); return text.length >= 12 && !/\b(idk|anyone|everyone|people|users|customers|not sure|n\/a|none|problem to validate|intended audience)\b/.test(text); }
function hasText(value: unknown) { return typeof value === "string" && value.trim().length >= 12; }
function hasAnyText(value: unknown) { return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0); }
function lower(value: string) { return value.replace(/^./, (character) => character.toLowerCase()); }
function emptyProof(): ProofSummary { return { people_contacted: 0, replies: 0, pain_confirmed: 0, interested_users: 0, waitlist_signups: 0, payment_intent: 0, preorders_or_revenue_cents: 0, experiment_count: 0, confidence_score: 0, confidence_label: "No evidence yet", evidence_sentence: "No evidence collected yet.", recommended_next_action: "Start one evidence-producing test." }; }
