import Link from "next/link";
import { ArrowRight, CheckCircle2, FolderKanban, History, Lightbulb, Users } from "lucide-react";
import { AdaptationSummary } from "@/components/founder-intelligence/adaptation-summary";
import { CrossProjectLearning } from "@/components/founder-learning/cross-project-learning";
import { ButtonLink } from "@/components/ui/button";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { getFounderIntelligence } from "@/lib/founder-intelligence/server";
import { getFounderLearningOverview } from "@/lib/founder-learning/server";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  title: string;
  status: "idea" | "validating" | "building" | "launched";
  lifecycle_status: "active" | "paused" | "completed" | "archived" | "abandoned";
  deleted_at: string | null;
  last_meaningful_activity_at: string;
  target_customer: string | null;
  report_json?: unknown;
  created_at: string;
  updated_at: string;
};

type ValidationRow = {
  id: string;
  project_id: string;
  title: string | null;
  status: string | null;
  people_contacted: number | null;
  replies: number | null;
  pain_confirmed: number | null;
  interested_users: number | null;
  waitlist_signups: number | null;
  payment_intent: number | null;
  preorders_or_revenue_cents: number | null;
  created_at: string;
  updated_at: string;
};

type DecisionRow = {
  id: string;
  project_id: string;
  decision_type: string;
  rationale: string;
  created_at: string;
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ learningQ?: string; learningCategory?: string; learningPage?: string }>;
}) {
  const [profile, supabase, params] = await Promise.all([requireProfile(), createClient(), searchParams]);
  await logBetaEvent({ userId: profile.id, eventName: "progress_page_viewed", source: "progress", throttleSeconds: 15 * 60 });

  const [learningOverview, intelligence] = await Promise.all([
    getFounderLearningOverview(profile.id, { query: params.learningQ, category: params.learningCategory, page: params.learningPage }),
    getFounderIntelligence(profile.id),
  ]);

  if (intelligence.source === "recalculated") {
    await logBetaEvent({ userId: profile.id, eventName: "inferred_adaptation_recalculated", source: "progress", metadata: { confidence: intelligence.profile.adaptationState.confidence, source_count: intelligence.profile.reliablePatterns.length, ai_used: false }, throttleSeconds: 15 * 60 });
  }
  if (intelligence.profile.adaptationState.confidence === "insufficient_history") {
    await logBetaEvent({ userId: profile.id, eventName: "personalization_data_insufficient", source: "progress", metadata: { eligible_project_count: intelligence.profile.verifiedExperience.eligibleProjectCount, ai_used: false }, throttleSeconds: 24 * 60 * 60 });
  }
  await logBetaEvent({ userId: profile.id, eventName: "cross_project_learning_viewed", source: "progress", metadata: { eligible_project_count: learningOverview.eligibleProjectCount, insight_count: learningOverview.totalInsights, category: learningOverview.category }, throttleSeconds: 15 * 60 });

  const db = supabase as any;
  const issues: string[] = [];
  const [projects, validationRows, decisions, focusRow] = await Promise.all([
    safeRows<ProjectRow>(
      db.from("opportunity_projects")
        .select("id,title,status,lifecycle_status,deleted_at,last_meaningful_activity_at,target_customer,report_json,created_at,updated_at")
        .eq("user_id", profile.id)
        .is("deleted_at", null)
        .order("last_meaningful_activity_at", { ascending: false })
        .limit(50),
      issues,
    ),
    safeRows<ValidationRow>(
      db.from("project_validation_experiments")
        .select("id,project_id,title,status,people_contacted,replies,pain_confirmed,interested_users,waitlist_signups,payment_intent,preorders_or_revenue_cents,created_at,updated_at")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(500),
      issues,
    ),
    safeRows<DecisionRow>(
      db.from("project_decisions")
        .select("id,project_id,decision_type,rationale,created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100),
      issues,
    ),
    safeMaybeSingle<{ project_id?: string | null }>(
      db.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(),
      issues,
    ),
  ]);

  const safeProjects = projects.map((project) => ({ ...project, title: getSafeDisplayProjectTitle(project) }));
  const currentProject = safeProjects.find((project) => project.id === focusRow?.project_id && project.lifecycle_status === "active")
    ?? safeProjects.find((project) => project.lifecycle_status === "active")
    ?? null;
  const currentProofRows = validationRows.filter((row) => row.project_id === currentProject?.id);
  const currentProof = summarizeProof(currentProofRows);
  const currentDecisions = decisions.filter((decision) => decision.project_id === currentProject?.id);
  const nextFocus = buildCurrentFocus(currentProject, currentProof);
  const projectTitles = new Map(safeProjects.map((project) => [project.id, project.title]));
  const recentActivity = buildRecentActivity(safeProjects, validationRows, decisions, projectTitles).slice(0, 8);
  const activeProjects = safeProjects.filter((project) => project.lifecycle_status === "active").length;

  return (
    <div>
      {issues.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          Some review data could not load. Your project workspace and saved evidence remain safe.
        </div>
      )}

      <section className="surface relative overflow-hidden p-7 sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-violet/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
          <div>
            <p className="eyebrow">Founder review</p>
            <h1 className="page-title mt-4 max-w-4xl">See what changed. Keep what matters.</h1>
            <p className="page-intro mt-4">A grounded review of recorded evidence, decisions, and reusable learning, focused on outcomes instead of activity.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={nextFocus.href}>Continue current work</ButtonLink>
            <ButtonLink href="/timeline" variant="secondary" className="gap-2"><History className="size-4" />Full history</ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
        <div className="surface border-l-2 border-l-violet p-6 sm:p-7">
          <p className="eyebrow">Recommended focus</p>
          <h2 className="mt-2 section-title">{nextFocus.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">{nextFocus.description}</p>
          <ButtonLink href={nextFocus.href} className="mt-5">Continue this project</ButtonLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <ReviewMetric icon={<FolderKanban className="size-5" />} label="Active projects" value={activeProjects} detail={`${safeProjects.length} preserved in your library`} />
          <ReviewMetric icon={<CheckCircle2 className="size-5" />} label="Evidence records" value={validationRows.length} detail="Real-world experiments and outcomes" />
          <ReviewMetric icon={<Lightbulb className="size-5" />} label="Decisions" value={decisions.length} detail="Meaningful choices kept in history" />
        </div>
      </section>

      {currentProject && (
        <section className="surface mt-6 p-6 sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="eyebrow">Current project</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{currentProject.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/55">{currentProject.target_customer ?? "Audience not recorded"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`/projects/${currentProject.id}?section=progress`} variant="secondary">Review project</ButtonLink>
              <ButtonLink href={`/projects/${currentProject.id}?section=validate`} variant="ghost">Add evidence</ButtonLink>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReviewMetric icon={<CheckCircle2 className="size-5" />} label="Experiments" value={currentProofRows.length} detail={`${currentProof.completedExperiments} completed`} />
            <ReviewMetric icon={<Users className="size-5" />} label="People reached" value={currentProof.peopleContacted} detail={`${currentProof.replies} replies recorded`} />
            <ReviewMetric icon={<Lightbulb className="size-5" />} label="Decisions" value={currentDecisions.length} detail="Founder-adopted changes" />
            <ReviewMetric icon={<CheckCircle2 className="size-5" />} label="Commitment signals" value={currentProof.waitlistSignups + currentProof.paymentIntent} detail={currentProof.revenueCents > 0 ? "Revenue evidence recorded" : "No revenue evidence yet"} />
          </div>
        </section>
      )}

      <section className="surface mt-6 p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Recent meaningful activity</p>
            <h2 className="mt-2 section-title">Evidence and decisions—not clicks.</h2>
          </div>
          <Link href="/timeline" className="inline-flex items-center gap-2 text-sm font-black text-violet hover:text-ink">Search all history <ArrowRight className="size-4" /></Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-cream/70 p-5 text-sm leading-6 text-ink/60">No meaningful activity yet. Create a project, test one assumption, and record what happened.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentActivity.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="rounded-2xl border border-ink/10 bg-cream/55 p-4 transition hover:-translate-y-px hover:border-violet/25 hover:bg-white hover:shadow-card">
                <p className="text-xs font-black uppercase tracking-[.14em] text-violet">{item.kind}</p>
                <p className="mt-2 line-clamp-2 font-bold leading-6 text-ink">{item.title}</p>
                <p className="mt-2 text-xs font-semibold text-ink/45">{item.projectTitle} · {formatShortDate(item.at)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AdaptationSummary profile={intelligence.profile} source={intelligence.source} />
      <CrossProjectLearning overview={learningOverview} />
    </div>
  );
}

function ReviewMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.13em] text-ink/50">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-violet/10 text-violet">{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink/50">{detail}</p>
    </div>
  );
}

function summarizeProof(rows: ValidationRow[]) {
  return rows.reduce(
    (summary, row) => ({
      peopleContacted: summary.peopleContacted + Number(row.people_contacted ?? 0),
      replies: summary.replies + Number(row.replies ?? 0),
      waitlistSignups: summary.waitlistSignups + Number(row.waitlist_signups ?? 0),
      paymentIntent: summary.paymentIntent + Number(row.payment_intent ?? 0),
      revenueCents: summary.revenueCents + Number(row.preorders_or_revenue_cents ?? 0),
      completedExperiments: summary.completedExperiments + (row.status === "completed" ? 1 : 0),
    }),
    { peopleContacted: 0, replies: 0, waitlistSignups: 0, paymentIntent: 0, revenueCents: 0, completedExperiments: 0 },
  );
}

function buildCurrentFocus(project: ProjectRow | null, proof: ReturnType<typeof summarizeProof>) {
  if (!project) return { title: "Create your first project", description: "Turn one idea into a focused workspace and one testable uncertainty.", href: "/generate" };
  if (proof.peopleContacted < 5) return { title: "Collect the first real-world signal", description: `Resume ${project.title}, choose a safe validation path, and record what actually happened.`, href: `/projects/${project.id}?section=validate` };
  if (proof.replies < 3) return { title: "Get three useful replies", description: "Replies help reveal whether the audience and opening question are specific enough.", href: `/projects/${project.id}?section=validate#proof-board` };
  if (proof.waitlistSignups + proof.paymentIntent < 1) return { title: "Look for one commitment signal", description: "Interest becomes more useful when someone joins a waitlist, agrees to a pilot, or discusses payment.", href: `/projects/${project.id}?section=validate#proof-board` };
  return { title: "Review what the evidence changed", description: "You have early signals. Read the decision history before choosing the next build or launch step.", href: `/projects/${project.id}?section=progress` };
}

function buildRecentActivity(projects: ProjectRow[], evidence: ValidationRow[], decisions: DecisionRow[], titles: Map<string, string>) {
  return [
    ...evidence.map((row) => ({
      id: row.id,
      kind: "Evidence",
      title: row.title ?? "Validation result",
      projectTitle: titles.get(row.project_id) ?? "Project",
      at: row.updated_at,
      href: `/projects/${row.project_id}?section=validate#proof-board`,
    })),
    ...decisions.map((row) => ({
      id: row.id,
      kind: "Decision",
      title: row.rationale || row.decision_type.replaceAll("_", " "),
      projectTitle: titles.get(row.project_id) ?? "Project",
      at: row.created_at,
      href: `/projects/${row.project_id}/timeline`,
    })),
    ...projects.map((row) => ({
      id: row.id,
      kind: "Project",
      title: row.title,
      projectTitle: row.lifecycle_status === "active" ? "Active workspace" : row.lifecycle_status,
      at: row.last_meaningful_activity_at ?? row.updated_at,
      href: `/projects/${row.id}`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "Recently";
  }
}

async function safeRows<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown query error");
    return [];
  }
  return data ?? [];
}

async function safeMaybeSingle<T>(query: PromiseLike<{ data: T | null; error: { message?: string } | null }>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown query error");
    return null;
  }
  return data;
}
