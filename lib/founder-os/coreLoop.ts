import type { BetaEventName } from "@/lib/analytics/betaEvents";

export type CoreLoopProgress = {
  projectCreated: boolean;
  projectSummaryViewed: boolean;
  primaryAssumptionViewed: boolean;
  nextBestActionViewed: boolean;
  nextBestActionStarted: boolean;
  actionSupportOpened: boolean;
  evidenceRecorded: boolean;
  recommendationUpdated: boolean;
  coreLoopCompleted: boolean;
  completedAt?: string;
};

export type CoreLoopEvent = {
  event_name: string;
  created_at: string;
};

const EVENT_TO_STATE: Partial<Record<BetaEventName, keyof CoreLoopProgress>> = {
  core_loop_project_created: "projectCreated",
  core_loop_summary_viewed: "projectSummaryViewed",
  core_loop_assumption_viewed: "primaryAssumptionViewed",
  core_loop_next_action_viewed: "nextBestActionViewed",
  core_loop_next_action_started: "nextBestActionStarted",
  core_loop_support_opened: "actionSupportOpened",
  core_loop_evidence_saved: "evidenceRecorded",
  core_loop_recommendation_updated: "recommendationUpdated",
};

export function deriveCoreLoopProgress({
  events,
  projectExists,
  evidenceCount,
  isSynthetic = false,
}: {
  events: CoreLoopEvent[];
  projectExists: boolean;
  evidenceCount: number;
  isSynthetic?: boolean;
}): CoreLoopProgress {
  const state: CoreLoopProgress = {
    projectCreated: projectExists,
    projectSummaryViewed: false,
    primaryAssumptionViewed: false,
    nextBestActionViewed: false,
    nextBestActionStarted: false,
    actionSupportOpened: false,
    evidenceRecorded: evidenceCount > 0,
    recommendationUpdated: false,
    coreLoopCompleted: false,
  };

  for (const event of events) {
    const key = EVENT_TO_STATE[event.event_name as BetaEventName];
    if (key && key !== "coreLoopCompleted" && key !== "completedAt") {
      state[key] = true as never;
    }
    if (event.event_name === "core_loop_completed" && !isSynthetic) {
      state.coreLoopCompleted = true;
      state.completedAt = event.created_at;
    }
  }

  // Completion is earned only after evidence changes the recommendation. Screen
  // views improve funnel diagnostics but can never complete the loop by themselves.
  if (!isSynthetic && state.evidenceRecorded && state.recommendationUpdated) {
    state.coreLoopCompleted = true;
    state.completedAt ??= latestEventAt(events, "core_loop_recommendation_updated");
  }

  return state;
}

export function coreLoopPercent(progress: CoreLoopProgress) {
  const milestones = [
    progress.projectCreated,
    progress.projectSummaryViewed,
    progress.primaryAssumptionViewed,
    progress.nextBestActionViewed,
    progress.nextBestActionStarted,
    progress.actionSupportOpened,
    progress.evidenceRecorded,
    progress.recommendationUpdated,
  ];
  return Math.round((milestones.filter(Boolean).length / milestones.length) * 100);
}

export function recommendationFingerprint(input: {
  assumptionKey: string;
  action: string;
  evidenceType: string;
}) {
  return [input.assumptionKey, input.action, input.evidenceType]
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export function betaCohorts(input: {
  businessType: string;
  projectCreatedAt: string;
  isSynthetic?: boolean;
}) {
  const created = new Date(input.projectCreatedAt).getTime();
  const focusModeStarted = Date.UTC(2026, 6, 16);
  return [
    input.isSynthetic ? "synthetic_tester" : created >= focusModeStarted ? "new_core_loop_beta" : "returning_old_version_tester",
    input.businessType === "service" || input.businessType === "agency" ? "service_idea" : "software_or_online_idea",
  ];
}

function latestEventAt(events: CoreLoopEvent[], eventName: string) {
  return events
    .filter((event) => event.event_name === eventName)
    .map((event) => event.created_at)
    .sort()
    .at(-1);
}
