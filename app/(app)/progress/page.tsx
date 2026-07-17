import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, CheckCircle2, Flame, FolderKanban, History, Lightbulb, Rocket, Sparkles, Trophy, WandSparkles, Zap } from "lucide-react";
import { QuestPanel } from "@/components/founder-os/quest-system";
import { ButtonLink } from "@/components/ui/button";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { levelProgress } from "@/lib/gamification/config";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import type { BusinessType, OpportunityReport } from "@/lib/founder-os/types";
import { scoreEvidence, scoreProjectClarity } from "@/lib/founder-os/valueProof";
import { LEVEL_CAP, LEVEL_REWARDS } from "@/lib/progress/levelPolicy";
import { buildFounderQuestPlan } from "@/lib/progress/questPolicy";
import { XP_GUIDE, ZERO_XP_EVENTS } from "@/lib/progress/xpPolicy";
import { createClient } from "@/lib/supabase/server";
import { routeValidationPath, type FounderValidationPreference, type ValidationPathType } from "@/lib/founder-os/validationReadiness";
import { CrossProjectLearning } from "@/components/founder-learning/cross-project-learning";
import { getFounderLearningOverview } from "@/lib/founder-learning/server";
import { AdaptationSummary } from "@/components/founder-intelligence/adaptation-summary";
import { getFounderIntelligence } from "@/lib/founder-intelligence/server";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

type ProjectStatus = "idea" | "validating" | "building" | "launched";
type ProjectRow = { id: string; title: string; status: ProjectStatus; lifecycle_status: "active" | "paused" | "completed" | "archived" | "abandoned"; deleted_at: string | null; last_meaningful_activity_at: string; score?: number | null; business_type?: string | null; target_customer?: string | null; report_json?: unknown; created_at: string; updated_at: string };
type OutputRow = { output_type: string; updated_at: string; project_id: string };
type ProgressEventRow = { id: string; project_id: string | null; reason: string; awarded_xp: number; verification_level: string; event_status: string; created_at: string; progression_category: string };
type ValidationRow = {
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

export default async function ProgressPage({searchParams}:{searchParams:Promise<{learningQ?:string;learningCategory?:string;learningPage?:string}>}) {
  const [profile, supabase,params] = await Promise.all([requireProfile(), createClient(),searchParams]);
  await logBetaEvent({ userId: profile.id, eventName: "progress_page_viewed", source: "progress", throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, eventName: "level_progress_viewed", source: "progress", throttleSeconds: 15 * 60 });
  const learningOverview=await getFounderLearningOverview(profile.id,{query:params.learningQ,category:params.learningCategory,page:params.learningPage});
  const intelligence = await getFounderIntelligence(profile.id);
  if (intelligence.source === "recalculated") await logBetaEvent({ userId: profile.id, eventName: "inferred_adaptation_recalculated", source: "progress", metadata: { confidence: intelligence.profile.adaptationState.confidence, source_count: intelligence.profile.reliablePatterns.length, ai_used: false }, throttleSeconds: 15 * 60 });
  if (intelligence.profile.adaptationState.confidence === "insufficient_history") await logBetaEvent({ userId: profile.id, eventName: "personalization_data_insufficient", source: "progress", metadata: { eligible_project_count: intelligence.profile.verifiedExperience.eligibleProjectCount, ai_used: false }, throttleSeconds: 24 * 60 * 60 });
  await logBetaEvent({userId:profile.id,eventName:"cross_project_learning_viewed",source:"progress",metadata:{eligible_project_count:learningOverview.eligibleProjectCount,insight_count:learningOverview.totalInsights,category:learningOverview.category},throttleSeconds:15*60});
  if(learningOverview.category==="validation")await logBetaEvent({userId:profile.id,eventName:"validation_method_comparison_viewed",source:"progress",metadata:{insight_count:learningOverview.totalInsights},throttleSeconds:15*60});
  if(learningOverview.category==="blocker")await logBetaEvent({userId:profile.id,eventName:"repeated_blocker_viewed",source:"progress",metadata:{insight_count:learningOverview.totalInsights},throttleSeconds:15*60});
  if(learningOverview.eligibleProjectCount<2)await logBetaEvent({userId:profile.id,eventName:"founder_learning_insufficient_data_viewed",source:"progress",metadata:{eligible_project_count:learningOverview.eligibleProjectCount},throttleSeconds:24*60*60});
  const db = supabase as any;
  const issues: string[] = [];

  const [projects, projectCount, outputCount, validationRows, xpRow, streakRow, recentOutputs, progressEvents, focusRow] = await Promise.all([
    safeRows<ProjectRow>(db.from("opportunity_projects").select("id,title,status,lifecycle_status,deleted_at,last_meaningful_activity_at,score,business_type,target_customer,report_json,created_at,updated_at").eq("user_id", profile.id).is("deleted_at", null).order("last_meaningful_activity_at", { ascending: false }).limit(50), issues),
    safeCount(db.from("opportunity_projects").select("*", { count: "exact", head: true }).eq("user_id", profile.id).is("deleted_at", null), issues),
    safeCount(db.from("project_outputs").select("*", { count: "exact", head: true }).eq("user_id", profile.id), issues),
    safeRows<ValidationRow>(db.from("project_validation_experiments").select("project_id,title,status,people_contacted,replies,pain_confirmed,interested_users,waitlist_signups,payment_intent,preorders_or_revenue_cents,created_at,updated_at").eq("user_id", profile.id), issues),
    safeMaybeSingle<{ total_xp?: number | null; legacy_xp?: number | null }>(db.from("user_xp").select("total_xp,legacy_xp").eq("user_id", profile.id).maybeSingle(), issues),
    safeMaybeSingle<{ current_streak?: number | null; longest_streak?: number | null }>(db.from("streaks").select("current_streak,longest_streak").eq("user_id", profile.id).maybeSingle(), issues),
    safeRows<OutputRow>(db.from("project_outputs").select("output_type,updated_at,project_id").eq("user_id", profile.id).order("updated_at", { ascending: false }).limit(5), issues),
    safeRows<ProgressEventRow>(db.from("xp_events").select("id,project_id,reason,awarded_xp,verification_level,event_status,created_at,progression_category").eq("user_id", profile.id).neq("awarded_xp", 0).order("created_at", { ascending: false }).limit(12), issues),
    safeMaybeSingle<{ project_id?: string | null }>(db.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(), issues),
  ]);

  const totalXp = Number(xpRow?.total_xp ?? 0);
  const safeProjects = projects.map((project) => ({ ...project, title: getSafeDisplayProjectTitle(project) }));
  const progress = levelProgress(totalXp);
  const statusCounts = countStatuses(safeProjects);
  const proof = summarizeProof(validationRows);
  const currentProject = safeProjects.find((project) => project.id === focusRow?.project_id && project.lifecycle_status === "active") ?? safeProjects.find((project) => project.lifecycle_status === "active") ?? null;
  const currentReport = isOpportunityReport(currentProject?.report_json) ? currentProject.report_json : null;
  const currentProjectProof = summarizeProof(validationRows.filter((row) => row.project_id === currentProject?.id));
  const currentProofSummary = toProofSummary(currentProjectProof);
  const [currentExperimentsResult, currentOutputsResult, currentPreferenceResult, currentActivePathResult] = currentProject && currentReport ? await Promise.all([
    supabase.from("project_validation_experiments").select("*").eq("project_id", currentProject.id).eq("user_id", profile.id),
    supabase.from("project_outputs").select("*").eq("project_id", currentProject.id).eq("user_id", profile.id),
    supabase.from("founder_validation_preferences").select("preference").eq("project_id", currentProject.id).eq("user_id", profile.id).maybeSingle(),
    supabase.from("validation_paths").select("path_type").eq("project_id", currentProject.id).eq("user_id", profile.id).eq("status", "active").maybeSingle(),
  ]) : [{ data: [] }, { data: [] }, { data: null }, { data: null }];
  const currentValidationPath = currentProject && currentReport ? routeValidationPath({ report: currentReport, status: currentProject.status, proof: currentProofSummary, experiments: currentExperimentsResult.data ?? [], outputs: currentOutputsResult.data ?? [], preference: currentPreferenceResult.data?.preference as FounderValidationPreference | undefined, forcedPath: currentActivePathResult.data?.path_type as ValidationPathType | undefined }) : null;
  const valueSnapshot = currentProject && currentReport
    ? {
        project: currentProject,
        clarity: scoreTo100(scoreProjectClarity(currentReport)),
        evidence: scoreTo100(scoreEvidence(toProofSummary(currentProjectProof), [])),
        nextAction: currentProjectProof.peopleContacted ? "Log the next proof signal." : "Start one validation experiment.",
        risk: currentProjectProof.peopleContacted ? "Payment evidence is still the key risk." : "No real-world evidence has been logged yet.",
      }
    : null;
  const currentFocus = buildCurrentFocus({ project: currentProject ?? undefined, proof });
  const questPlan = buildFounderQuestPlan({
    userId: profile.id,
    project: currentProject && currentReport ? {
      id: currentProject.id,
      title: currentProject.title,
      status: currentProject.status,
      business_type: (currentProject.business_type ?? currentReport.input.businessType) as BusinessType,
      target_customer: currentProject.target_customer ?? currentReport.summary.targetCustomer,
      report_json: currentReport,
      created_at: currentProject.created_at,
      updated_at: currentProject.updated_at,
      lifecycle_status: currentProject.lifecycle_status,
      deleted_at: currentProject.deleted_at,
    } : null,
    report: currentReport,
    proof: currentReport ? currentProofSummary : null,
    validationPath: currentValidationPath,
    guidancePreferences: intelligence.profile.explicitPreferences,
  });
  const recentActivity = buildRecentActivity({ projects: safeProjects, validationRows, recentOutputs }).slice(0, 5);
  const launchMomentum = Math.min(100, Math.round(
    (projectCount ? 22 : 0) +
    (statusCounts.validating ? 18 : 0) +
    (statusCounts.building ? 22 : 0) +
    (statusCounts.launched ? 18 : 0) +
    (outputCount ? 12 : 0) +
    (proof.peopleContacted ? 8 : 0),
  ));

  return (
    <div>
      {issues.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          Some progress data could not load. Your core workspace is still safe.
        </div>
      )}

      <section className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-ink p-7 text-white shadow-glow sm:p-8">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-20 left-20 size-56 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-gold">
              <Sparkles className="size-4" />
              Founder journey
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">One path. One next move. Real proof.</h1>
            <p className="mt-3 max-w-2xl leading-7 text-white/70">
              Founder level reflects documented execution across projects. It never changes a project&apos;s evidence score or guarantees business quality.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={currentFocus.href} className="bg-gold text-ink hover:bg-white">Do next action</ButtonLink>
            <ButtonLink href="/projects" variant="secondary" className="border-white/30 bg-white text-ink hover:bg-gold">Open projects</ButtonLink>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-moss/15 bg-gradient-to-br from-white via-lime/15 to-gold/15 p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Next milestone</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{currentFocus.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">{currentFocus.description}</p>
        <ButtonLink href={currentFocus.href} className="mt-5">Continue this project</ButtonLink>
      </section>

      {valueSnapshot && (
        <section className="mt-6 rounded-[2rem] border border-violet/15 bg-white p-6 shadow-card">
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet">What changed</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{valueSnapshot.project.title}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <StatCard icon={<CheckCircle2 className="size-5" />} label="Evidence" value={`${valueSnapshot.evidence}/100`} detail="Only recorded proof counts" />
            <StatCard icon={<Lightbulb className="size-5" />} label="Unresolved risk" value="1" detail={valueSnapshot.risk} />
            <StatCard icon={<Rocket className="size-5" />} label="Next milestone" value="Now" detail={valueSnapshot.nextAction} />
          </div>
          <ButtonLink href={`/projects/${valueSnapshot.project.id}/value-proof`} variant="secondary" className="mt-5">Review evidence and decisions</ButtonLink>
        </section>
      )}

      <details className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
        <summary className="cursor-pointer list-none"><p className="text-xs font-black uppercase tracking-[.16em] text-violet">Advanced progress</p><h2 className="mt-2 font-display text-2xl font-semibold text-ink">Open levels, quests, and longer-term learning</h2><p className="mt-2 text-sm leading-6 text-ink/55">These systems are optional. They never replace evidence or the next project action.</p></summary>
        <div className="mt-6 border-t border-ink/10 pt-1">

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="rounded-[2rem] border border-gold/30 bg-gradient-to-br from-white via-gold/10 to-lime/25 p-6 shadow-card">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet">
                <Zap className="size-4" />
                Your level journey
              </p>
              <p className="mt-4 font-display text-6xl font-semibold leading-none text-ink">Lv {progress.level}</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[.12em] text-ink/65">{progress.title} · {totalXp} XP</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">{progress.meaning}</p>
            </div>
            <div className="grid size-20 place-items-center rounded-[1.5rem] bg-ink text-gold shadow-glow">
              <Trophy className="size-9" />
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[.14em] text-ink/65">
              <span>Next level</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-violet via-moss to-gold transition-all duration-700" style={{ width: `${progress.progress}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/60">
              {progress.level >= LEVEL_CAP ? "Highest progression level reached." : `${Math.max(0, progress.nextLevelXp - totalXp)} XP to Level ${progress.level + 1}. Next recognition: ${progress.nextReward}.`}
            </p>
            {Number(xpRow?.legacy_xp ?? 0) > 0 && <p className="mt-2 text-xs font-semibold leading-5 text-ink/45">Includes {Number(xpRow?.legacy_xp ?? 0)} legacy XP preserved from the earlier system. Legacy XP is not presented as verified evidence.</p>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-moss">
            <Rocket className="size-4" />
            Today&apos;s focus
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">{currentFocus.title}</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">{currentFocus.description}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[.12em]">
            <span className="rounded-full bg-coral/10 px-4 py-2 text-coral"><Flame className="mr-1 inline size-4" />{Number(streakRow?.current_streak ?? 0)}-day streak</span>
            <span className="rounded-full bg-cream px-4 py-2 text-ink/60">Best: {Number(streakRow?.longest_streak ?? 0)} days</span>
          </div>
          <ButtonLink href={currentFocus.href} className="mt-5">Continue</ButtonLink>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FolderKanban className="size-5" />} label="Projects" value={projectCount} detail={`${statusCounts.building + statusCounts.launched} building or launched`} />
        <StatCard icon={<WandSparkles className="size-5" />} label="AI outputs" value={outputCount} detail="Saved execution assets" />
        <StatCard icon={<BarChart3 className="size-5" />} label="Proof contacts" value={proof.peopleContacted} detail={`${proof.replies} replies · ${proof.painConfirmed} pain confirmed`} />
        <StatCard icon={<Rocket className="size-5" />} label="Launch momentum" value={`${launchMomentum}%`} detail={launchMomentum >= 70 ? "Strong private-alpha signal" : "Keep collecting proof"} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <QuestPanel title="Daily quest" quests={questPlan.dailyQuest ? [questPlan.dailyQuest] : []} tone="violet" />
        <QuestPanel title="Weekly quests" quests={questPlan.weeklyQuests} tone="moss" weeklyOutcome={questPlan.weeklyOutcome} />
      </section>

      {valueSnapshot && (
        <section className="mt-8 rounded-[2rem] border border-violet/15 bg-gradient-to-br from-white via-violet/5 to-lime/20 p-6 shadow-card">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[.16em] text-violet">Value Proof snapshot</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{valueSnapshot.project.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
                Progress should show transformation and proof: what PrismForge helped structure, and what real people have actually confirmed.
              </p>
            </div>
            <ButtonLink href={`/projects/${valueSnapshot.project.id}/value-proof`} className="bg-gold text-ink hover:bg-white">View Value Proof</ButtonLink>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<BarChart3 className="size-5" />} label="Clarity" value={`${valueSnapshot.clarity}/100`} detail="How structured this project is" />
            <StatCard icon={<CheckCircle2 className="size-5" />} label="Evidence" value={`${valueSnapshot.evidence}/100`} detail="Only real-world proof counts" />
            <StatCard icon={<Lightbulb className="size-5" />} label="Current risk" value="1" detail={valueSnapshot.risk} />
            <StatCard icon={<Rocket className="size-5" />} label="Next action" value="Now" detail={valueSnapshot.nextAction} />
          </div>
        </section>
      )}

      <AdaptationSummary profile={intelligence.profile} source={intelligence.source} />
      <CrossProjectLearning overview={learningOverview} />

      <section className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-sm font-black uppercase tracking-[.16em] text-moss">Level rewards</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Unlocks without the clutter.</h2>
          <div className="mt-5 grid gap-2">
            {LEVEL_REWARDS.map((reward) => {
              const unlocked = progress.level >= reward.level;
              return (
                <div key={reward.label} className={`flex items-center gap-3 rounded-2xl border p-3 text-sm ${unlocked ? "border-moss/20 bg-lime/25 text-ink" : "border-ink/10 bg-cream/60 text-ink/55"}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${unlocked ? "bg-moss text-white" : "bg-white text-ink/40"}`}>{reward.level}</span>
                  <span><span className="font-bold">{reward.label}</span><span className="ml-2 text-xs font-semibold text-ink/45">{reward.kind}</span></span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-sm font-black uppercase tracking-[.16em] text-violet">How to earn XP</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Founder XP comes from useful action.</h2>
          <div className="mt-5 grid gap-3">
            {XP_GUIDE.map((item) => (
              <div key={item.label} className="rounded-2xl bg-cream/65 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-ink">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-ink/60">Full credit requires project state or supporting evidence. Detailed manual work receives reduced credit.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-violet">up to +{item.baseXp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet"><History className="size-4" />Recent founder XP</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Every award has a reason.</h2>
          <div className="mt-5 grid gap-3">
            {progressEvents.length === 0 ? <p className="rounded-2xl bg-cream/70 p-5 text-sm leading-6 text-ink/60">No evidence-based XP yet. Complete a quest or record a detailed Proof Board result.</p> : progressEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-ink/10 bg-cream/55 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div><p className="font-bold text-ink">{event.reason}</p><p className="mt-1 text-xs font-semibold text-ink/45">{verificationLabel(event.verification_level)} · {formatShortDate(event.created_at)}</p></div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${event.awarded_xp > 0 ? "bg-lime/40 text-moss" : "bg-coral/10 text-coral"}`}>{event.awarded_xp > 0 ? "+" : ""}{event.awarded_xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-ink/10 bg-cream/60 p-6 shadow-card">
          <p className="text-sm font-black uppercase tracking-[.16em] text-moss">What does not earn progress</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">No busywork XP.</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-ink/65">
            {ZERO_XP_EVENTS.map((item) => <li key={item} className="flex gap-3 rounded-2xl bg-white p-3"><span aria-hidden="true" className="font-black text-coral">0</span><span>{item}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[.16em] text-moss">Recent meaningful activity</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">The latest signals that moved forward</h2>
          </div>
          <ButtonLink href="/projects" variant="secondary">Open workspace</ButtonLink>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-cream/70 p-5 text-sm leading-6 text-ink/60">No activity yet. Create a project, generate one execution asset, or log one Proof Board signal.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {recentActivity.map((item) => (
              <Link key={`${item.kind}-${item.at}-${item.title}`} href={item.href} className="rounded-2xl border border-ink/10 bg-cream/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                <p className="text-xs font-black uppercase tracking-[.14em] text-violet">{item.kind}</p>
                <p className="mt-2 font-bold text-ink">{item.title}</p>
                <p className="mt-1 text-xs font-semibold text-ink/45">{formatShortDate(item.at)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
        </div>
      </details>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/65">{label}</p>
        <div className="grid size-11 place-items-center rounded-2xl bg-violet/10 text-violet">{icon}</div>
      </div>
      <p className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink/60">{detail}</p>
    </div>
  );
}

function countStatuses(projects: ProjectRow[]) {
  return projects.reduce<Record<ProjectStatus, number>>((counts, project) => {
    counts[project.status] = (counts[project.status] ?? 0) + 1;
    return counts;
  }, { idea: 0, validating: 0, building: 0, launched: 0 });
}

function summarizeProof(rows: ValidationRow[]) {
  return rows.reduce(
    (summary, row) => ({
      peopleContacted: summary.peopleContacted + Number(row.people_contacted ?? 0),
      replies: summary.replies + Number(row.replies ?? 0),
      painConfirmed: summary.painConfirmed + Number(row.pain_confirmed ?? 0),
      interestedUsers: summary.interestedUsers + Number(row.interested_users ?? 0),
      waitlistSignups: summary.waitlistSignups + Number(row.waitlist_signups ?? 0),
      paymentIntent: summary.paymentIntent + Number(row.payment_intent ?? 0),
      revenueCents: summary.revenueCents + Number(row.preorders_or_revenue_cents ?? 0),
      completedExperiments: summary.completedExperiments + (row.status === "completed" ? 1 : 0),
    }),
    { peopleContacted: 0, replies: 0, painConfirmed: 0, interestedUsers: 0, waitlistSignups: 0, paymentIntent: 0, revenueCents: 0, completedExperiments: 0 },
  );
}

function buildCurrentFocus({ project, proof }: { project?: ProjectRow; proof: ReturnType<typeof summarizeProof> }) {
  if (!project) return { title: "Create your first project", description: "Turn one idea into a workspace. Then PrismForge can give you a useful next move.", href: "/generate" };
  if (proof.peopleContacted < 5) return { title: "Choose a validation path", description: `Resume ${project.title} and use the Validate section to collect real-world signal without overexposing the idea.`, href: `/projects/${project.id}?section=validate` };
  if (proof.replies < 3) return { title: "Get your first 3 replies", description: "Replies show whether your audience and opening message are sharp enough.", href: `/projects/${project.id}?section=validate#proof-board` };
  if (proof.painConfirmed < 3) return { title: "Confirm pain with 3 people", description: "Progress becomes meaningful when real users confirm the problem, not just the idea.", href: `/projects/${project.id}?section=validate#proof-board` };
  if (proof.waitlistSignups < 1 && proof.interestedUsers < 1) return { title: "Get one beta or waitlist signal", description: "Ask interested users to make a small commitment before building more.", href: `/projects/${project.id}?section=launch#first-dollar-sprint` };
  if (proof.paymentIntent < 1 && proof.revenueCents <= 0) return { title: "Test payment intent", description: "Ask what someone would pay for the smallest useful version.", href: `/projects/${project.id}?section=launch#first-dollar-sprint` };
  return { title: "Move toward a tiny launch", description: "You have early signal. Use Launch Command Center to invite testers without overbuilding.", href: `/projects/${project.id}?section=launch#launch-command-center` };
}

function buildRecentActivity({ projects, validationRows, recentOutputs }: { projects: ProjectRow[]; validationRows: ValidationRow[]; recentOutputs: OutputRow[] }) {
  return [
    ...projects.map((project) => ({ kind: "Project", title: project.title, at: project.updated_at, href: `/projects/${project.id}` })),
    ...validationRows.map((row) => ({ kind: row.payment_intent && row.payment_intent > 0 ? "Payment signal" : "Proof Board", title: row.title ?? "Validation experiment", at: row.updated_at, href: `/projects/${row.project_id}?section=validate#proof-board` })),
    ...recentOutputs.map((output) => ({ kind: "AI output", title: formatOutputType(output.output_type), at: output.updated_at, href: `/projects/${output.project_id}` })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "Recently";
  }
}

function formatOutputType(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function verificationLabel(value: string) {
  if (value === "system_verified") return "Verified in PrismForge";
  if (value === "evidence_supported") return "Evidence attached";
  if (value === "manual_detailed") return "Manually recorded";
  if (value === "legacy") return "Legacy progress";
  return "More detail needed";
}

function scoreTo100(items: Array<{ score: number; max: number }>) {
  const score = items.reduce((sum, item) => sum + item.score, 0);
  const max = items.reduce((sum, item) => sum + item.max, 0);
  return Math.round((score / Math.max(1, max)) * 100);
}

function toProofSummary(proof: ReturnType<typeof summarizeProof>) {
  return {
    people_contacted: proof.peopleContacted,
    replies: proof.replies,
    pain_confirmed: proof.painConfirmed,
    interested_users: proof.interestedUsers,
    waitlist_signups: proof.waitlistSignups,
    payment_intent: proof.paymentIntent,
    preorders_or_revenue_cents: proof.revenueCents,
    experiment_count: proof.completedExperiments,
    confidence_score: 0,
    confidence_label: "No evidence yet" as const,
    evidence_sentence: "",
    recommended_next_action: "",
  };
}

function isOpportunityReport(value: unknown): value is OpportunityReport {
  return Boolean(value && typeof value === "object" && "summary" in value && "mvpPlan" in value && "executionRoadmap" in value);
}

async function safeRows<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, issues: string[]) {
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

async function safeMaybeSingle<T>(query: PromiseLike<{ data: T | null; error: { message?: string } | null }>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(error.message ?? "Unknown query error");
    return null;
  }
  return data;
}
