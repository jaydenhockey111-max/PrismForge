import type { ProjectLifecycleStatus } from "@/lib/database.types";
import type { ProjectStatus } from "@/lib/founder-os/types";

export const PROJECT_LIFECYCLE_STATUSES = ["active", "paused", "completed", "archived", "abandoned"] as const;
export const PROJECT_LIFECYCLE_ACTIONS = ["pause", "resume", "complete", "archive", "abandon", "restore", "soft_delete", "permanent_delete"] as const;
export type ProjectLifecycleAction = (typeof PROJECT_LIFECYCLE_ACTIONS)[number];
export type ProjectLibraryFilter = "all" | ProjectLifecycleStatus | "deleted";
export type ProjectLibrarySort = "focus" | "recent_activity" | "recently_created" | "stage" | "name";

export const PROJECT_LIFECYCLE_LABELS: Record<ProjectLifecycleStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
  abandoned: "Stopped",
};

export const PROJECT_LIFECYCLE_DESCRIPTIONS: Record<ProjectLifecycleStatus, string> = {
  active: "Currently available for Today, quests, and validation work.",
  paused: "Work is paused. The stage, proof, and history are preserved.",
  completed: "The intended journey ended and its lessons remain available.",
  archived: "Removed from everyday work while preserving its complete history.",
  abandoned: "Intentionally stopped. Evidence and lessons remain available without judgment.",
};

export type LifecycleSummary = {
  id: string;
  lifecycleStatus: ProjectLifecycleStatus;
  stage: ProjectStatus;
  isCurrentFocus: boolean;
  deletedAt: string | null;
  lastMeaningfulActivityAt: string;
  createdAt: string;
  title: string;
};

export function canTransition(status: ProjectLifecycleStatus, action: ProjectLifecycleAction, deletedAt: string | null) {
  if (action === "permanent_delete") return Boolean(deletedAt);
  if (deletedAt) return action === "restore";
  if (action === "soft_delete") return true;
  if (action === "pause") return status === "active";
  if (action === "resume") return status === "paused";
  if (action === "restore") return status === "completed" || status === "archived" || status === "abandoned";
  if (action === "complete" || action === "archive" || action === "abandon") return status !== (action === "complete" ? "completed" : action === "archive" ? "archived" : "abandoned");
  return false;
}

export function requiresClosureReflection(action: ProjectLifecycleAction) { return action === "complete" || action === "abandon"; }
export function requiresReason(action: ProjectLifecycleAction) { return action === "pause" || action === "abandon" || action === "restore"; }

export function compareLifecycleProjects(a: LifecycleSummary, b: LifecycleSummary, sort: ProjectLibrarySort) {
  if (sort === "focus") return Number(b.isCurrentFocus) - Number(a.isCurrentFocus) || lifecycleRank(a) - lifecycleRank(b) || byActivity(a, b);
  if (sort === "recently_created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (sort === "stage") return stageRank(a.stage) - stageRank(b.stage) || byActivity(a, b);
  if (sort === "name") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  return byActivity(a, b);
}

export function matchesLifecycleFilter(project: LifecycleSummary, filter: ProjectLibraryFilter) {
  if (filter === "deleted") return Boolean(project.deletedAt);
  if (project.deletedAt) return false;
  return filter === "all" || project.lifecycleStatus === filter;
}

export function chooseFallbackFocus(projects: LifecycleSummary[]) {
  return projects.filter((project) => !project.deletedAt && project.lifecycleStatus === "active").sort((a, b) => byActivity(a, b) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

export const PERMANENT_DELETION_POLICY = {
  cascades: ["project core data", "generation history containing the report", "assumptions", "evidence and experiments", "decisions", "validation paths", "AI outputs", "closure reflections"],
  preserved: ["founder XP total", "sanitized XP ledger entries", "privacy-safe lifecycle event categories", "aggregate analytics required for reliability"],
  cleared: ["project title and report", "private evidence text", "customer quotes", "closure-reflection content", "project-linked local workspace on the current browser when revisited"],
} as const;

function lifecycleRank(project: LifecycleSummary) { return project.deletedAt ? 5 : ({ active: 0, paused: 1, completed: 2, archived: 3, abandoned: 4 } satisfies Record<ProjectLifecycleStatus, number>)[project.lifecycleStatus]; }
function stageRank(stage: ProjectStatus) { return ({ idea: 0, validating: 1, building: 2, launched: 3 } satisfies Record<ProjectStatus, number>)[stage]; }
function byActivity(a: LifecycleSummary, b: LifecycleSummary) { return new Date(b.lastMeaningfulActivityAt).getTime() - new Date(a.lastMeaningfulActivityAt).getTime(); }
