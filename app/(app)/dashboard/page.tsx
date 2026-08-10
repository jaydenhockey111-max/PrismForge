import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BetaGuideLauncher } from "@/components/beta-guide-launcher";
import { ProjectStatusBadge } from "@/components/founder-os/project-status-badge";
import { LifecycleBadge } from "@/components/founder-os/project-lifecycle-controls";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { ProjectAssumption, ProjectDecision, ProjectOutput, ProjectValidationExperiment, ValidationPathRow } from "@/lib/database.types";
import { BUSINESS_TYPE_LABELS } from "@/lib/founder-os/helpers";
import { buildNextMove } from "@/lib/founder-os/nextMove";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { routeValidationPath, type FounderValidationPreference, type ValidationPathHistoryInput, type ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const [profile, params, supabase] = await Promise.all([requireProfile(), searchParams, createClient()]);
  await logBetaEvent({ userId: profile.id, eventName: "dashboard_viewed", source: "dashboard", throttleSeconds: 15 * 60 });
  const db = supabase as any;
  const issues: string[] = [];
  const [recentProjects, totalProjects, focusRow, activeProjectCount] = await Promise.all([
    safeRows(db.from("opportunity_projects").select("id,title,business_type,target_customer,status,lifecycle_status,last_meaningful_activity_at,updated_at,report_json").eq("user_id", profile.id).is("deleted_at", null).order("last_meaningful_activity_at", { ascending: false }).limit(6), issues),
    safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).is("deleted_at", null), issues),
    safeMaybeSingle<{ project_id?: string | null }>(db.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(), issues),
    safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("lifecycle_status", "active").is("deleted_at", null), issues),
  ]);

  const safeRecentProjectsUnsorted = recentProjects.map((project: any) => ({ ...project, title: getSafeDisplayProjectTitle(project) }));
  if (focusRow?.project_id && !safeRecentProjectsUnsorted.some((project: any) => project.id === focusRow.project_id)) {
    const focused = await safeMaybeSingle<any>(db.from("opportunity_projects").select("id,title,business_type,target_customer,status,lifecycle_status,last_meaningful_activity_at,updated_at,report_json").eq("id",focusRow.project_id).eq("user_id",profile.id).eq("lifecycle_status","active").is("deleted_at",null).maybeSingle(),issues);
    if (focused) safeRecentProjectsUnsorted.unshift({ ...focused, title:getSafeDisplayProjectTitle(focused) });
  }
  const safeRecentProjects = [...safeRecentProjectsUnsorted].sort((a, b) => Number(b.id === focusRow?.project_id) - Number(a.id === focusRow?.project_id)).slice(0, 4);
  const currentProject = safeRecentProjectsUnsorted.find((project: any) => project.id === focusRow?.project_id && project.lifecycle_status === "active")
    ?? safeRecentProjectsUnsorted.find((project: any) => project.lifecycle_status === "active")
    ?? null;
  const nextMove = currentProject ? await getFocusedNextMove(db, profile.id, currentProject, issues) : null;
  const name = profile.name?.split(" ")[0] ?? "founder";
  const dashboardMove: DashboardMove = nextMove ? {
    title: nextMove.title,
    description: nextMove.why,
    doneWhen: nextMove.doneWhen,
    whatChanged: nextMove.whatChanged,
    evidenceState: nextMove.evidenceState,
    href: `/projects/${currentProject.id}?section=today#next-move`,
    cta: "Open your Next Move",
  } : getDashboardNextMove({ totalProjects, recentProjectId: currentProject?.id });
  const isFirstTime = totalProjects === 0;
  if (!isFirstTime && activeProjectCount === 0) await logBetaEvent({ userId: profile.id, eventName: "no_active_project_state_viewed", source: "dashboard", metadata: { total_projects: totalProjects }, throttleSeconds: 15 * 60 });

  return (
    <div>
      <FormMessage message={params.message} type="success" />
      <FormMessage message={params.error ?? (issues.length ? "Some dashboard data could not load. If this is a fresh install, run the latest Supabase migration." : undefined)} />

      <section className="surface overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_17rem]">
          <div className="p-7 sm:p-9 lg:p-10">
            <p className="eyebrow">Today</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em] text-ink sm:text-5xl">Welcome back, {name}.</h1>
            <div className="mt-8 max-w-3xl border-l-2 border-violet pl-5">
              <p className="text-sm font-bold text-violet">Your next move</p>
               <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.025em] text-ink sm:text-4xl">{dashboardMove.title}</h2>
               <p className="mt-3 max-w-2xl leading-7 text-ink/60">{dashboardMove.description}</p>
               {dashboardMove.doneWhen && <p className="mt-4 max-w-2xl rounded-2xl bg-cream/70 p-4 text-sm font-semibold leading-6 text-ink/65"><span className="font-black text-ink">Done when:</span> {dashboardMove.doneWhen}</p>}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
               <ButtonLink href={dashboardMove.href} className="gap-2">{dashboardMove.cta}<ArrowRight className="size-4" /></ButtonLink>
              {!isFirstTime && <ButtonLink href="/projects" variant="secondary">View projects</ButtonLink>}
              <BetaGuideLauncher compactButton />
            </div>
          </div>
          <div className="border-t border-ink/10 bg-cream/65 p-7 lg:border-l lg:border-t-0 lg:p-8">
             <p className="text-xs font-bold uppercase tracking-[.16em] text-ink/40">Since you were last here</p>
             <p className="mt-4 text-sm font-semibold leading-6 text-ink/65">{dashboardMove.whatChanged ?? "No material project outcome has been recorded yet."}</p>
             {dashboardMove.evidenceState && <p className="mt-4 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-moss">{dashboardMove.evidenceState}</p>}
          </div>
        </div>
      </section>

      {!profile.onboarding_completed && (
        <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-950">Quick setup recommended.</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">Your profile helps PrismForge personalize project reports and Next Moves.</p>
          <ButtonLink href="/settings" variant="secondary" className="mt-4">Finish settings</ButtonLink>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Projects</p>
            <h2 className="mt-2 section-title">Pick up where you left off</h2>
          </div>
          {!isFirstTime && <ButtonLink href="/generate" variant="secondary">Create another project</ButtonLink>}
        </div>

        {safeRecentProjects.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-moss/25 bg-white p-6 text-sm leading-6 text-ink/60">
            <p className="font-display text-2xl font-semibold text-ink">No projects yet.</p>
            <p className="mt-2">Use the primary button at the top to create your first project workspace.</p>
            <p className="mt-3 rounded-2xl bg-cream/70 p-4 font-semibold text-ink/65">Not seeing a project you created? Make sure you signed in with the same email you used when creating it.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {safeRecentProjects.map((project: any) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="group surface-flat p-6 transition duration-200 hover:-translate-y-px hover:border-ink/20 hover:shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2"><LifecycleBadge status={project.lifecycle_status} currentFocus={project.id === focusRow?.project_id} /><ProjectStatusBadge status={project.status as ProjectStatus} /></div>
                  {project.id === focusRow?.project_id && <span className="rounded-full bg-lime/30 px-3 py-1 text-xs font-black text-moss">Current focus</span>}
                </div>
                <h3 className="mt-5 font-display text-2xl font-semibold leading-tight tracking-[-.025em] text-ink group-hover:text-violet">{project.title}</h3>
                <p className="mt-3 text-sm text-ink/55">{BUSINESS_TYPE_LABELS[project.business_type as BusinessType]} · {project.target_customer}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-ink/65">Meaningful activity {formatDistanceToNowStrict(new Date(project.last_meaningful_activity_at ?? project.updated_at), { addSuffix: true })}<ArrowUpRight className="size-3.5" /></p>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

type DashboardMove = { title: string; description: string; href: string; cta: string; doneWhen?: string; whatChanged?: string; evidenceState?: string };

function getDashboardNextMove(input: { totalProjects: number; recentProjectId?: string }): DashboardMove {
  if (input.totalProjects === 0) {
    return {
      title: "Create your first project.",
      description: "Tell PrismForge what you are building. You will get one clear action and a way to record what happens.",
      doneWhen: "The project is saved and its first Next Move is visible.",
      whatChanged: "There is no project history yet.",
      evidenceState: "No external evidence recorded yet",
      href: "/generate",
      cta: "Create your first project",
    };
  }
  if (input.recentProjectId) {
    return {
      title: "Open the project and confirm its current Next Move.",
      description: "PrismForge needs the saved project context before it can show the evidence-aware recommendation here.",
      href: `/projects/${input.recentProjectId}?section=today`,
      cta: "Open project",
    };
  }
  return {
    title: "Choose one current project.",
    description: "Set a current focus so Today can show one project-specific Next Move.",
    href: "/projects",
    cta: "Choose current focus",
  };
}

async function getFocusedNextMove(db: any, userId: string, project: any, issues: string[]) {
  const report = project.report_json as OpportunityReport;
  if (!report?.input || !report?.summary || !report?.mvpPlan) return null;

  const [experiments, decisions, assumptions, preference, paths, outputs] = await Promise.all([
    safeRows(db.from("project_validation_experiments").select("*").eq("user_id", userId).eq("project_id", project.id).order("updated_at", { ascending: false }), issues),
    safeRows(db.from("project_decisions").select("*").eq("user_id", userId).eq("project_id", project.id).order("created_at", { ascending: false }).limit(25), issues),
    safeRows(db.from("project_assumptions").select("assumption_key,status,statement").eq("user_id", userId).eq("project_id", project.id), issues),
    safeMaybeSingle<any>(db.from("founder_validation_preferences").select("preference").eq("user_id", userId).eq("project_id", project.id).maybeSingle(), issues),
    safeRows(db.from("validation_paths").select("*").eq("user_id", userId).eq("project_id", project.id).order("created_at", { ascending: false }), issues),
    safeRows(db.from("project_outputs").select("output_type").eq("user_id", userId).eq("project_id", project.id), issues),
  ]);
  const proofRows = experiments as ProjectValidationExperiment[];
  const history = paths as ValidationPathRow[];
  const active = history.find((path) => path.status === "active");
  const route = routeValidationPath({
    report,
    status: project.status as ProjectStatus,
    proof: summarizeProof(proofRows),
    preference: (preference?.preference ?? null) as FounderValidationPreference | null,
    experiments: proofRows,
    assumptions: assumptions as Pick<ProjectAssumption, "assumption_key" | "status" | "statement">[],
    decisions: decisions as ProjectDecision[],
    outputs: outputs as ProjectOutput[],
    pathHistory: history.map((path) => ({ path_type: path.path_type, status: path.status, source: path.source, created_at: path.created_at })) as ValidationPathHistoryInput[],
    forcedPath: active?.path_type as ValidationRoutingResult["pathType"] | undefined,
  });
  return buildNextMove({ projectId: project.id, report, status: project.status as ProjectStatus, proof: summarizeProof(proofRows), route, experiments: proofRows, decisions: decisions as ProjectDecision[] });
}

async function safeRows(query: PromiseLike<{ data: any[] | null; error: { message?: string } | null }>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown query error");
    return [];
  }
  return data ?? [];
}

async function safeCount(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>, issues: string[]) {
  const { count, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown count error");
    return 0;
  }
  return count ?? 0;
}

async function safeMaybeSingle<T>(query: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown query error");
    return null;
  }
  return data;
}
