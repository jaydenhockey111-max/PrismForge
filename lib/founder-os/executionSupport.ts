import type { ProjectValidationExperiment } from "@/lib/database.types";
import { createProjectContext } from "@/lib/founder-os/projectContext";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";
import type { ProofSummary } from "@/lib/proof-board";

export type ExecutionSupport = {
  type: "customer_discovery" | "demand_test" | "pricing_test" | "prototype_test" | "contradiction_resolution" | "launch_readiness" | "research" | "project_clarification" | "outcome_review";
  executionMode: "FOUNDER_ACTION" | "AI_ASSISTED" | "AI_EXECUTABLE";
  primaryLabel: string;
  title: string;
  summary: string;
  steps: Array<{ title: string; detail: string }>;
  artifacts: Array<{ label: string; content: string }>;
  doneWhen: string;
  evidenceToRecord: string;
  changedVariable: string | null;
};

type Input = {
  report: OpportunityReport;
  status: ProjectStatus;
  proof: ProofSummary;
  route: ValidationRoutingResult;
  experiments?: ProjectValidationExperiment[];
};

/**
 * The single contract between canonical Next Move routing and execution help.
 * It deliberately prepares deterministic, factual materials; opening help never
 * creates evidence or triggers a model request.
 */
export function buildExecutionSupport({ report, status, proof, route, experiments = [] }: Input): ExecutionSupport {
  const context = createProjectContext({ report, status, proof });
  const audience = context.audience;
  const user = context.language.userNoun;
  const problem = lower(context.problem);
  const project = context.title;
  const constraints = constraintLine(context.founder);
  const isContradiction = route.decision.reason === "contradictory_evidence";
  const isFollowUp = route.decision.reason === "inconclusive_result";

  if (isContradiction) {
    return support({
      type: "contradiction_resolution",
      primaryLabel: "Prepare contradiction follow-ups",
      title: "Resolve the conflicting evidence",
      summary: `Do not pitch ${project} or repeat the old path. Compare the assumed problem with what ${user} actually do today.${constraints}`,
      steps: [
        step("Choose the disagreement", `Use the active assumption: ${route.targetAssumption}`),
        step("Ask for current behavior", `Talk to ${audience} about the last time ${problem} happened before describing your solution.`),
        step("Decide from the pattern", "Record examples that support and contradict the assumption, then narrow, revise, or pause it."),
      ],
      artifacts: [
        artifact("Follow-up message", `I’m revisiting how ${audience} handle ${problem}. Could I ask about the last time it happened? I’m comparing an assumption with real behavior, not pitching a solution.`),
        artifact("Disconfirming questions", numbered([
          `Tell me about the last time ${problem} came up. What did you do?`,
          "What made that workaround good enough, if anything?",
          "Which part of this problem feels least important or is already solved?",
          "What would have to be true for you to change your current behavior?",
        ])),
      ],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: "The contradictory examples, current behavior, and the decision they support.",
      changedVariable: "The test changes from confirming the assumption to actively looking for disconfirming behavior.",
    });
  }

  if (route.pathType === "pricing_test") {
    const prior = latestPricingAttempt(experiments);
    const changedVariable = isFollowUp
      ? "Keep the audience and channel fixed; change the ask from a broad price question to a narrow paid pilot with one explicit outcome."
      : null;
    return support({
      type: "pricing_test",
      primaryLabel: isFollowUp ? "Prepare the revised price test" : "Prepare the price test",
      title: isFollowUp ? "Run a meaningfully different pricing follow-up" : "Test one explicit price",
      summary: isFollowUp
        ? `The recorded pricing test had no payment signal. This follow-up tests the offer and commitment ask, rather than repeating the same pitch.${constraints}`
        : `Ask people who understand ${problem} for a concrete commitment, not a compliment about ${project}.${constraints}`,
      steps: [
        step("Choose one outcome", `Offer one narrow result for ${audience}; do not present a feature list.`),
        step("Use one explicit ask", "Ask for a paid pilot, deposit, preorder, or a clearly classified no."),
        step("Record the response", "Separate interest, payment intent, and payment. A zero result is still useful evidence."),
      ],
      artifacts: [
        artifact("Pricing hypothesis", `${audience} will consider paying for a narrow ${project} outcome when the result, timing, and commitment are clear.`),
        artifact("Offer wording", `I’m testing a small ${project} pilot for ${audience} who want help with ${problem}. It would focus on one clear outcome rather than a full product. Would you consider a paid early pilot if the scope and price were explicit?`),
        artifact("Willingness-to-pay questions", numbered([
          "What would need to be true for this to be worth paying for?",
          "Which outcome would make this valuable enough to try first?",
          "Would you prefer a small paid pilot, a deposit, or to decline for now? Why?",
        ])),
      ],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: prior ? changedVariable : null,
    });
  }

  if (["customer_discovery", "service_pilot", "marketplace_supply_test", "marketplace_demand_test"].includes(route.pathType)) {
    const role = route.pathType === "marketplace_supply_test" ? "potential providers" : route.pathType === "marketplace_demand_test" ? "potential buyers" : user;
    return support({
      type: "customer_discovery",
      primaryLabel: route.pathType === "service_pilot" ? "Prepare the pilot conversations" : "Prepare customer conversations",
      title: route.pathType === "service_pilot" ? "Offer a narrow pilot" : "Talk to the right people",
      summary: `Start with ${audience}. The material below keeps the conversation focused on real behavior and the current uncertainty.${constraints}`,
      steps: [
        step("Who to contact", `Find ${role} who have recently experienced ${problem}. Prioritize people with a recent, specific story.`),
        step("Send one simple message", "Ask for a short conversation; do not pitch the whole product."),
        step("Use the questions", "Follow the current behavior before asking about a possible solution."),
        step("Record the outcome", `Log the conversations and repeated pattern when you are done. ${route.firstAction.doneWhen}`),
      ],
      artifacts: [
        artifact("Outreach message", `Hi — I’m researching how ${audience} handle ${problem}. Could I ask you a few short questions about the last time it came up? I’m trying to learn before building more.`),
        artifact("Conversation questions", numbered([
          `When was the last time ${problem} happened?`,
          "What did you do first, and what was frustrating about that?",
          "What does the current workaround cost you in time, money, or effort?",
          "What would make a different approach worth trying?",
          route.pathType === "service_pilot" ? "Would a small, clearly scoped paid pilot be useful? What outcome would it need to deliver?" : "May I follow up if I test a small version of a solution?",
        ])),
      ],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: null,
    });
  }

  if (["landing_page_test", "waitlist_test", "content_test"].includes(route.pathType)) {
    const ask = route.pathType === "content_test" ? "reply, save, or start a qualified conversation" : route.pathType === "landing_page_test" ? "take one measurable action on the page" : "join the waitlist";
    const noPaidDefault = context.founder.budget <= 0 ? "Use direct outreach, communities you already participate in, or organic posts—not paid ads." : "Start with the lowest-cost channel where this audience already gathers.";
    return support({
      type: "demand_test",
      primaryLabel: "Prepare the demand test",
      title: isFollowUp ? "Run a changed demand follow-up" : "Run one focused demand test",
      summary: `${noPaidDefault} Test one message, one audience, and one commitment action.${constraints}`,
      steps: [
        step("Set the test", `Use one promise for ${audience} and one action: ${ask}.`),
        step("Choose distribution", noPaidDefault),
        step("Define success before sending", route.successCondition),
        step("Record the factual result", "Log reach, response, commitments, and what was changed. Do not count views alone as proof."),
      ],
      artifacts: [
        artifact("Offer headline", `${project} for ${audience} who want to make progress on ${problem}.`),
        artifact("Distribution copy", `I’m testing a simple way for ${audience} to handle ${problem}. If this is a current problem for you, ${route.pathType === "waitlist_test" ? "join the early list" : "reply and I’ll share the small test"}. I’m looking for honest reactions before building more.`),
        artifact("Success condition", route.successCondition),
      ],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: isFollowUp ? "Change one variable only: the message, audience, channel, or commitment ask. Keep the other variables visible for comparison." : null,
    });
  }

  if (["prototype_test", "physical_product_test"].includes(route.pathType)) {
    const noCode = context.founder.technicalAbility === "low" ? "Use a sketch, clickable mockup, spreadsheet, or manual service—not custom code." : "Use the fastest artifact that makes the core workflow visible.";
    return support({
      type: "prototype_test",
      primaryLabel: "Scope the smallest prototype",
      title: "Show one useful workflow",
      summary: `${noCode} The goal is a reaction to one before-and-after experience, not a finished product.${constraints}`,
      steps: [
        step("Choose one workflow", `Show how ${audience} move from ${problem} toward ${context.desiredOutcome}.`),
        step("Build only the proof", noCode),
        step("Do not build yet", "Skip accounts, settings, automation, integrations, and edge cases unless they are the workflow being tested."),
        step("Watch a real reaction", "Ask someone to try the artifact and record where it helps, confuses, or fails."),
      ],
      artifacts: [
        artifact("Prototype scope", `One screen or manual walkthrough: show the starting problem, one core action, and the immediate outcome for ${audience}.`),
        artifact("Test instructions", `Show the artifact to one relevant person. Ask them to complete the core task without coaching, then ask what felt useful, confusing, or missing.`),
        artifact("Feedback questions", numbered(["What did you think this would help you do?", "Where did you hesitate or get confused?", "Would this change what you do today? Why or why not?"])),
      ],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: null,
    });
  }

  if (route.pathType === "launch_readiness") {
    return support({
      type: "launch_readiness",
      primaryLabel: "Prepare the launch check",
      title: "Check one complete first-user flow",
      summary: `Use a real first-user journey for ${project}; completing a checklist is not evidence.${constraints}`,
      steps: [step("Pick the core flow", route.firstAction.action), step("Run it end to end", "Include the first acquisition or invitation step, delivery or account path, core outcome, and feedback route."), step("Fix the highest blocker", "Capture one observed failure before moving to another improvement."), step("Record the result", route.firstAction.evidenceToRecord)],
      artifacts: [artifact("Launch-check script", `As a new ${user}, can I discover ${project}, complete the core action, reach the intended outcome, and tell the founder what went wrong?`), artifact("Blocker note", "Observed blocker: ___\nWhere it occurred: ___\nWho was affected: ___\nWhat changed before retesting: ___")],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: null,
    });
  }

  if (route.pathType === "private_research") {
    return support({
      type: "research",
      primaryLabel: "Prepare the research review",
      title: "Find one repeated behavior pattern",
      summary: `Research is preparation, not validation. Use it to make the next external test more specific.${constraints}`,
      steps: [step("Choose three sources", `Find recent public discussions or reviews from ${audience}.`), step("Capture the wording", `Record the exact behavior and language around ${problem}.`), step("Name the unresolved question", "End with a question to test with a real person, not a market conclusion.")],
      artifacts: [artifact("Research note", "Source: ___\nObserved behavior: ___\nRepeated wording: ___\nWhat this contradicts or supports: ___\nQuestion to test next: ___")],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: null,
    });
  }

  if (route.pathType === "project_clarification") {
    return support({
      type: "project_clarification",
      primaryLabel: "Clarify the test brief",
      title: "Write the testable version of the project",
      summary: "This is a preparation step. It makes the next external test specific; it does not validate the idea.",
      steps: [step("Name one audience", `Use a narrow group, not “everyone”: ${audience}.`), step("Name one painful moment", context.problem), step("Name the desired outcome", context.desiredOutcome), step("Choose one assumption", route.targetAssumption)],
      artifacts: [artifact("One-sentence brief", `${audience} struggle with ${problem} and want ${context.desiredOutcome}. I will test whether this is painful enough to change current behavior.`)],
      doneWhen: route.firstAction.doneWhen,
      evidenceToRecord: route.firstAction.evidenceToRecord,
      changedVariable: null,
    });
  }

  return support({
    type: "outcome_review",
    primaryLabel: "Prepare the outcome review",
    title: "Learn from one real outcome",
    summary: `Focus on what ${user} actually did, not on planned work or generated materials.${constraints}`,
    steps: [step("Choose one recent outcome", route.firstAction.action), step("Compare intent with reality", "Identify the observed behavior, friction, and the smallest improvement."), step("Record the decision", "Save the result and one next action.")],
    artifacts: [artifact("Outcome review", "Expected outcome: ___\nWhat actually happened: ___\nObserved friction or success: ___\nOne change to test next: ___")],
    doneWhen: route.firstAction.doneWhen,
    evidenceToRecord: route.firstAction.evidenceToRecord,
    changedVariable: null,
  });
}

function support(value: Omit<ExecutionSupport, "executionMode">): ExecutionSupport {
  return { ...value, executionMode: value.type === "research" ? "AI_EXECUTABLE" : "FOUNDER_ACTION" };
}
function step(title: string, detail: string) { return { title, detail }; }
function artifact(label: string, content: string) { return { label, content }; }
function numbered(values: string[]) { return values.map((value, index) => `${index + 1}. ${value}`).join("\n"); }
function lower(value: string) { return value.replace(/^./, (character) => character.toLowerCase()); }
function constraintLine(founder: ReturnType<typeof createProjectContext>["founder"]) {
  const items: string[] = [];
  if (founder.budget <= 0) items.push("No paid spend is assumed");
  if (founder.hoursPerWeek <= 5) items.push(`Keep this within ${founder.hoursPerWeek} hours this week`);
  if (founder.technicalAbility === "low") items.push("No custom code is required");
  return items.length ? ` ${items.join(". ")}.` : "";
}
function latestPricingAttempt(experiments: ProjectValidationExperiment[]) {
  return experiments.find((experiment) => experiment.evidence_type === "pricing_response" || /pricing|price|payment/i.test(experiment.title));
}
