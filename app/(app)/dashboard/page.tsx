import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, ArrowUpRight, CheckCircle2, FolderKanban, HelpCircle, MessageCircle, Rocket, Trophy, Users } from "lucide-react";
import { BetaGuideLauncher } from "@/components/beta-guide-launcher";
import { ProjectStatusBadge } from "@/components/founder-os/project-status-badge";
import { LifecycleBadge } from "@/components/founder-os/project-lifecycle-controls";
import { RewardChestReveal } from "@/components/reward-chest-reveal";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { BusinessType, ProjectStatus } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS, PROJECT_STATUSES } from "@/lib/founder-os/helpers";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import { levelProgress } from "@/lib/gamification/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; chest?: string; reward?: string; rewardDescription?: string; levelUp?: string }>;
}) {
  const [profile, params, supabase] = await Promise.all([requireProfile(), searchParams, createClient()]);
  await logBetaEvent({ userId: profile.id, eventName: "dashboard_viewed", source: "dashboard", throttleSeconds: 15 * 60 });
  const db = supabase as any;
  const issues: string[] = [];
  const [recentProjects, totalProjects, statusCounts, xpRow, focusRow, activeProjectCount] = await Promise.all([
    safeRows(db.from("opportunity_projects").select("id,title,business_type,target_customer,score,status,lifecycle_status,last_meaningful_activity_at,updated_at,report_json").eq("user_id", profile.id).is("deleted_at", null).order("last_meaningful_activity_at", { ascending: false }).limit(6), issues),
    safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).is("deleted_at", null), issues),
    Promise.all(PROJECT_STATUSES.map(async (status) => [status, await safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("lifecycle_status", "active").is("deleted_at", null).eq("status", status), issues)] as const)),
    safeMaybeSingle(db.from("user_xp").select("*").eq("user_id", profile.id).maybeSingle(), issues),
    safeMaybeSingle<{ project_id?: string | null }>(db.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(), issues),
    safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("lifecycle_status", "active").is("deleted_at", null), issues),
  ]);

  const counts = Object.fromEntries(statusCounts) as Record<ProjectStatus, number>;
  const safeRecentProjectsUnsorted = recentProjects.map((project: any) => ({ ...project, title: getSafeDisplayProjectTitle(project) }));
  if (focusRow?.project_id && !safeRecentProjectsUnsorted.some((project: any) => project.id === focusRow.project_id)) {
    const focused = await safeMaybeSingle<any>(db.from("opportunity_projects").select("id,title,business_type,target_customer,score,status,lifecycle_status,last_meaningful_activity_at,updated_at,report_json").eq("id",focusRow.project_id).eq("user_id",profile.id).eq("lifecycle_status","active").is("deleted_at",null).maybeSingle(),issues);
    if (focused) safeRecentProjectsUnsorted.unshift({ ...focused, title:getSafeDisplayProjectTitle(focused) });
  }
  const safeRecentProjects = [...safeRecentProjectsUnsorted].sort((a, b) => Number(b.id === focusRow?.project_id) - Number(a.id === focusRow?.project_id)).slice(0, 4);
  const name = profile.name?.split(" ")[0] ?? "founder";
  const totalXp = Number((xpRow as { total_xp?: number | null } | null)?.total_xp ?? 0);
  const progress = levelProgress(totalXp);
  const nextMove = getDashboardNextMove({
    totalProjects,
    recentProjectId: focusRow?.project_id ?? safeRecentProjects.find((project: any) => project.lifecycle_status === "active")?.id,
    validating: counts.validating ?? 0,
    building: counts.building ?? 0,
    launched: counts.launched ?? 0,
  });
  const isFirstTime = totalProjects === 0;
  if (!isFirstTime && activeProjectCount === 0) await logBetaEvent({ userId: profile.id, eventName: "no_active_project_state_viewed", source: "dashboard", metadata: { total_projects: totalProjects }, throttleSeconds: 15 * 60 });

  return (
    <div>
      <RewardChestReveal reward={params.chest ? params.reward : undefined} description={params.rewardDescription} level={params.levelUp} />
      <FormMessage message={params.message} type="success" />
      <FormMessage message={params.error ?? (issues.length ? "Some dashboard data could not load. If this is a fresh install, run the latest Supabase migration." : undefined)} />

      <section className="surface overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_17rem]">
          <div className="p-7 sm:p-9 lg:p-10">
            <p className="eyebrow">Today</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em] text-ink sm:text-5xl">Welcome back, {name}.</h1>
            <div className="mt-8 max-w-3xl border-l-2 border-violet pl-5">
              <p className="text-sm font-bold text-violet">Your next move</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.025em] text-ink sm:text-3xl">{nextMove.title}</h2>
              <p className="mt-3 max-w-2xl leading-7 text-ink/60">{nextMove.description}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={nextMove.href} className="gap-2">{nextMove.cta}<ArrowRight className="size-4" /></ButtonLink>
              {!isFirstTime && <ButtonLink href="/projects" variant="secondary">View projects</ButtonLink>}
              <BetaGuideLauncher compactButton />
            </div>
          </div>
          <div className="border-t border-ink/10 bg-cream/65 p-7 lg:border-l lg:border-t-0 lg:p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-ink/40">Working principle</p>
            <p className="mt-4 font-display text-xl font-semibold leading-7 tracking-[-.02em] text-ink">One project. One uncertainty. One real-world action.</p>
            <p className="mt-4 text-sm leading-6 text-ink/55">Small, recorded tests create better decisions than more planning.</p>
          </div>
        </div>
      </section>

      {!profile.onboarding_completed && (
        <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <p className="font-bold text-amber-950">Quick setup recommended.</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">Your profile helps PrismForge personalize project reports and next actions.</p>
          <ButtonLink href="/settings" variant="secondary" className="mt-4">Finish settings</ButtonLink>
        </section>
      )}

      <section className="mt-8">
        <div className="surface p-6">
          <p className="eyebrow">One simple loop</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Open one project", "Test the biggest question", "Record what happened", "Use the updated action"].map((step, index) => (
              <div key={step} className="flex gap-3 rounded-xl border border-ink/[.07] bg-cream/55 p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-violet shadow-sm">{index + 1}</span>
                <p className="pt-0.5 text-sm font-semibold leading-6 text-ink/70">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <details className="surface mt-8 p-5"><summary className="cursor-pointer text-sm font-bold text-violet">Open activity overview</summary><section className="mt-5 grid gap-4 border-t border-ink/10 pt-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FolderKanban className="size-5" />} label="Active projects" value={activeProjectCount} detail={`${totalProjects} preserved across your project library`} tone="sky" />
        <StatCard icon={<Trophy className="size-5" />} label="Founder level" value={progress.level} detail={`${totalXp} XP from meaningful actions`} tone="gold" />
        <StatCard icon={<Rocket className="size-5" />} label="Building/launched" value={(counts.building ?? 0) + (counts.launched ?? 0)} detail="Projects that moved beyond idea mode" tone="lime" />
        <StatCard icon={<Users className="size-5" />} label="Validation focus" value={counts.validating ?? 0} detail="Projects currently proving the pain" tone="violet" />
      </section></details>

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

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <QuickLink href="/help/faq" icon={<HelpCircle className="size-5" />} title="Not sure what something means?" text="Read the FAQ before getting lost in the interface." />
        <QuickLink href="/beta-guide" icon={<CheckCircle2 className="size-5" />} title="Testing PrismForge?" text="Use the beta guide for the recommended test flow." />
        <QuickLink href="/help" icon={<MessageCircle className="size-5" />} title="Something confusing or broken?" text="Send beta support a clear note or use the feedback button." />
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone: "sky" | "gold" | "lime" | "violet" }) {
  const tones = {
    sky: "bg-sky/35 border-blue-100",
    gold: "bg-gold/20 border-gold/30",
    lime: "bg-lime/30 border-moss/15",
    violet: "bg-violet/10 border-violet/15",
  };
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/65">{label}</p>
        <div className="grid size-10 place-items-center rounded-xl bg-white/80 text-violet shadow-sm">{icon}</div>
      </div>
      <p className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/60">{detail}</p>
    </div>
  );
}

function QuickLink({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="group surface-flat p-5 transition hover:-translate-y-px hover:border-ink/20 hover:shadow-card">
      <div className="grid size-10 place-items-center rounded-xl bg-violet/10 text-violet">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold tracking-[-.02em] text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/60">{text}</p>
    </Link>
  );
}

function getDashboardNextMove(input: { totalProjects: number; recentProjectId?: string; validating: number; building: number; launched: number }) {
  if (input.totalProjects === 0) {
    return {
      title: "Create your first project.",
      description: "Use one idea. PrismForge will turn it into a report, validation plan, and project workspace.",
      href: "/generate",
      cta: "Create your first project",
    };
  }
  if (input.validating + input.building + input.launched === 0 && input.recentProjectId) {
    return {
      title: "Move one project into validation.",
      description: "Open your newest project, read the Next Best Action, and start one Proof Board experiment.",
      href: `/projects/${input.recentProjectId}`,
      cta: "Open newest project",
    };
  }
  if (input.recentProjectId) {
    return {
      title: "Log one real-world signal.",
      description: "Contact people outside the app, then add replies, pain confirmation, waitlist interest, or payment intent to Proof Board.",
      href: `/projects/${input.recentProjectId}`,
      cta: "Resume project",
    };
  }
  return {
    title: "Open your projects.",
    description: "Pick one idea and make one small validation move.",
    href: "/projects",
    cta: "Open projects",
  };
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
