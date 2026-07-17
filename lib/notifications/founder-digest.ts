import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OpportunityProject, Profile } from "@/lib/database.types";
import type { OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";

type AdminClient = SupabaseClient<Database>;

export type FounderDigestProject = Pick<OpportunityProject, "id" | "title" | "business_type" | "target_customer" | "score" | "status" | "created_at" | "updated_at" | "report_json"> & {
  report: OpportunityReport | null;
  reason: "stuck_idea" | "high_score" | "building" | "launched" | "recent";
};

export type FounderDigest = {
  user: Profile;
  weekKey: string;
  projects: FounderDigestProject[];
  counts: Record<ProjectStatus, number>;
  bestScore: number | null;
  nextActions: string[];
};

const DAY_MS = 86_400_000;

export const FOUNDER_DIGEST_LIMITS = {
  profileBatchSize: numberFromEnv("FOUNDER_DIGEST_PROFILE_BATCH_SIZE", 500, 25, 2_000),
  maxProjectsPerDigest: numberFromEnv("FOUNDER_DIGEST_MAX_PROJECTS", 5, 1, 10),
  stuckIdeaDays: numberFromEnv("FOUNDER_DIGEST_STUCK_IDEA_DAYS", 7, 2, 60),
  recentProjectDays: numberFromEnv("FOUNDER_DIGEST_RECENT_PROJECT_DAYS", 14, 1, 60),
  minHighScore: numberFromEnv("FOUNDER_DIGEST_MIN_HIGH_SCORE", 75, 1, 100),
};

function numberFromEnv(key: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[key]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

export function founderWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function getFounderDigestProfiles(admin: AdminClient) {
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("alerts_enabled", true)
    .order("created_at", { ascending: true })
    .limit(FOUNDER_DIGEST_LIMITS.profileBatchSize);
  if (error) throw error;
  return data ?? [];
}

export async function buildFounderDigestForProfile(admin: AdminClient, profile: Profile, now = new Date()): Promise<FounderDigest | null> {
  const projectAdmin = admin as any;
  const { data, error } = await projectAdmin
    .from("opportunity_projects")
    .select("*")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const projects = ((data ?? []) as OpportunityProject[]).map((project) => ({
    ...project,
    report: safeReport(project.report_json),
    reason: projectReason(project, now),
  }));

  if (!projects.length) return null;

  const valuable = projects
    .filter((project) => isDigestWorthy(project, now))
    .sort(projectSort)
    .slice(0, FOUNDER_DIGEST_LIMITS.maxProjectsPerDigest);

  if (!valuable.length) return null;

  const counts = {
    idea: projects.filter((project) => project.status === "idea").length,
    validating: projects.filter((project) => project.status === "validating").length,
    building: projects.filter((project) => project.status === "building").length,
    launched: projects.filter((project) => project.status === "launched").length,
  };

  const bestScore = projects.reduce<number | null>((best, project) => best === null ? project.score : Math.max(best, project.score), null);

  return {
    user: profile,
    weekKey: founderWeekKey(now),
    projects: valuable,
    counts,
    bestScore,
    nextActions: createNextActions(valuable, counts),
  };
}

function safeReport(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as OpportunityReport;
}

function projectReason(project: OpportunityProject, now: Date): FounderDigestProject["reason"] {
  const updatedAt = new Date(project.updated_at).getTime();
  const daysSinceUpdate = (now.getTime() - updatedAt) / DAY_MS;
  if (project.status === "launched") return "launched";
  if (project.status === "building") return "building";
  if (project.status === "idea" && daysSinceUpdate >= FOUNDER_DIGEST_LIMITS.stuckIdeaDays) return "stuck_idea";
  if (project.score >= FOUNDER_DIGEST_LIMITS.minHighScore) return "high_score";
  return "recent";
}

function isDigestWorthy(project: FounderDigestProject, now: Date) {
  const updatedAt = new Date(project.updated_at).getTime();
  const daysSinceUpdate = (now.getTime() - updatedAt) / DAY_MS;
  if (project.reason === "stuck_idea" || project.reason === "high_score" || project.reason === "building" || project.reason === "launched") return true;
  return daysSinceUpdate <= FOUNDER_DIGEST_LIMITS.recentProjectDays;
}

function projectSort(a: FounderDigestProject, b: FounderDigestProject) {
  const priority = { stuck_idea: 5, high_score: 4, building: 3, launched: 2, recent: 1 };
  const byReason = priority[b.reason] - priority[a.reason];
  if (byReason !== 0) return byReason;
  return b.score - a.score;
}

function createNextActions(projects: FounderDigestProject[], counts: Record<ProjectStatus, number>) {
  const actions: string[] = [];
  if (projects.some((project) => project.reason === "stuck_idea")) actions.push("Pick one Idea project and move it to Validating after one customer conversation.");
  if (projects.some((project) => project.reason === "high_score")) actions.push("Choose your highest-score project and create one waitlist or preorder test this week.");
  if (counts.validating > 0) actions.push("For validating projects, collect 10 real replies before writing more code.");
  if (counts.building > 0) actions.push("For building projects, cut one non-essential feature and ship a smaller version.");
  if (counts.launched > 0) actions.push("For launched projects, ask active users what they would pay to make faster or easier.");
  if (!actions.length) actions.push("Generate one new report or update a saved project status so your dashboard stays alive.");
  return actions.slice(0, 4);
}
