import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import { createProjectContext } from "@/lib/founder-os/projectContext";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";

export type CeoDirective = {
  phase: string;
  priority: string;
  selectedTask: string;
  rationale: string;
  founderWarning: string;
  nextCheckIn: string;
};

type CeoInput = {
  status: ProjectStatus;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
};

export function ceoLiveStatus({ status, report, sprintTasks }: CeoInput) {
  const context = createProjectContext({ report, status });
  if (status === "idea") return sprintTasks?.length ? "Status: Validation plan is loaded." : "Status: Waiting on validation evidence.";
  if (status === "validating") return `Status: Watching for evidence from ${context.language.userNoun}.`;
  if (status === "building") return `Status: ${context.language.releaseNoun} sprint is active.`;
  if (status === "launched") return `Status: Watching feedback from ${context.language.userNoun}.`;
  return "Status: Reviewing founder roadmap.";
}

export function generateCeoDirective({ status, report, sprintTasks = [] }: CeoInput): CeoDirective {
  const context = createProjectContext({ report, status });
  const selectedTask = selectTask(status, sprintTasks, report);
  const targetCustomer = context.audience;
  const firstMvpSlice = firstString(report.mvpPlan?.mustHaveFeatures) ?? firstString(report.mvpPlan?.featureList) ?? context.language.productNoun;
  const phase = phaseLabel(status);

  if (status === "idea") {
    return {
      phase,
      priority: `${context.language.validationVerb} before adding scope.`,
      selectedTask,
      rationale: `${context.title} is still in Idea mode. The next useful move is evidence from ${context.language.userNoun}, not generic startup planning.`,
      founderWarning: `Do not polish the ${context.language.productNoun} until at least five real ${context.language.userNoun} respond in their own words.`,
      nextCheckIn: `After the first 5 replies, move to Validating or rewrite the ${context.solutionCategory.toLowerCase()} niche.`,
    };
  }

  if (status === "validating") {
    return {
      phase,
      priority: "Turn interest into proof of urgency.",
      selectedTask,
      rationale: `You are validating, so the CEO priority is evidence. Use the sprint task to convert ${targetCustomer} from vague interest into a clear yes/no signal.`,
      founderWarning: "Do not mistake compliments for demand. Look for waitlist joins, replies, calls booked, or payment intent.",
      nextCheckIn: `Review conversion from outreach to replies before expanding the ${context.language.releaseNoun}.`,
    };
  }

  if (status === "building") {
    return {
      phase,
      priority: `Ship the narrowest ${context.language.releaseNoun} slice.`,
      selectedTask,
      rationale: `We are currently in the Building phase. Your top priority today is executing the technical sprint task, not expanding scope. The first proof point is: ${firstMvpSlice}.`,
      founderWarning: `Do not add new features until this slice is usable by one real ${context.language.userNoun.slice(0, -1) || "person"}.`,
      nextCheckIn: `Once the slice works end-to-end, send it to the first ${context.language.userNoun} immediately.`,
    };
  }

  return {
    phase,
    priority: `Push distribution and learn from real ${context.language.userNoun}.`,
    selectedTask,
    rationale: `The project is live enough to seek feedback, so the CEO priority moves from building to learning loops. Use content, outreach, and real responses to decide what to improve next.`,
    founderWarning: `Do not hide in polish. If ${context.language.userNoun} are not seeing it, the ${context.language.releaseNoun} is not really being tested.`,
    nextCheckIn: "Review signups, replies, and objections after the next distribution push.",
  };
}

function selectTask(status: ProjectStatus, sprintTasks: SprintTaskOutput[], report: OpportunityReport) {
  const context = createProjectContext({ report, status });
  const preferredCategory = status === "building" ? "Technical" : status === "launched" ? "Marketing" : "Validation";
  const memoryTask = sprintTasks.find((task) => task.category === preferredCategory) ?? sprintTasks[0];
  if (memoryTask) return `${memoryTask.category}: ${memoryTask.task}`;
  const firstMvpSlice = firstString(report.mvpPlan?.mustHaveFeatures) ?? firstString(report.mvpPlan?.featureList) ?? context.language.productNoun;
  const contentHook = firstString(report.contentPlan?.shortFormHooks) ?? safeString(report.contentPlan?.shockValueAngle, "the strongest customer pain point");
  const targetCustomer = context.audience;
  const painPoint = context.problem;
  if (status === "building") return `Technical: ${context.language.buildVerb} only this first slice: ${firstMvpSlice}.`;
  if (status === "launched") return `Marketing: Publish one proof-driven post using this hook: ${contentHook}.`;
  return `Validation: Interview 5 ${targetCustomer} about "${painPoint}".`;
}

function phaseLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    idea: "Idea phase",
    validating: "Validation phase",
    building: "Building phase",
    launched: "Launch phase",
  };
  return labels[status];
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function firstString(value: unknown) {
  return Array.isArray(value) ? value.find((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;
}
