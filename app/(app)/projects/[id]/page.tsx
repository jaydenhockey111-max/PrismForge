import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowDownToLine, ArrowLeft, CalendarDays, History } from "lucide-react";
import { CompetitorTable } from "@/components/founder-os/competitor-table";
import { ContentIdeasGrid } from "@/components/founder-os/content-ideas-grid";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import { LifecycleBadge, ProjectLifecycleControls } from "@/components/founder-os/project-lifecycle-controls";
import { FirstDollarSprint } from "@/components/founder-os/first-dollar-sprint";
import { LandingPagePreview } from "@/components/founder-os/landing-page-preview";
import { LaunchCommandCenter } from "@/components/founder-os/launch-command-center";
import { MonetizationCard } from "@/components/founder-os/monetization-card";
import { MvpPlanCard } from "@/components/founder-os/mvp-plan-card";
import { OpportunityScoreCard } from "@/components/founder-os/opportunity-score-card";
import { OutreachKit } from "@/components/founder-os/outreach-kit";
import { ProofBoard } from "@/components/founder-os/proof-board";
import { ProjectClosureReflectionCard } from "@/components/founder-os/project-closure-reflection";
import { ProjectStatusBadge } from "@/components/founder-os/project-status-badge";
import { ProjectStatusSelect } from "@/components/founder-os/project-status-select";
import { ProjectTitleEditor } from "@/components/founder-os/project-title-editor";
import { ReportSectionCard } from "@/components/founder-os/report-section-card";
import { RoadmapTimeline } from "@/components/founder-os/roadmap-timeline";
import { ValueProofCard } from "@/components/founder-os/value-proof-card";
import { HistoricalLearningReminder } from "@/components/founder-learning/historical-learning-reminder";
import { ProjectLearningControl } from "@/components/founder-learning/project-learning-control";
import { ValidationPathWorkspace } from "@/components/founder-os/validation-path-workspace";
import { BiggestQuestionCard, CoreValueFeedback, TrackedCoreActionLink } from "@/components/founder-os/core-loop-experience";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { ProjectClosureReflection, ProjectLifecycleStatus, ProjectOutput, ProjectOutputType, ProjectValidationExperiment } from "@/lib/database.types";
import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import { BUSINESS_TYPE_LABELS } from "@/lib/founder-os/helpers";
import { opportunityReportToMarkdown } from "@/lib/founder-os/markdown";
import { PROJECT_SECTIONS, parseProjectSection, type ProjectSection } from "@/lib/founder-os/projectNavigation";
import { completeNextBestActionDetail, getNextBestActionDetail, type NextBestActionDetail } from "@/lib/founder-os/projectAlpha";
import { cleanProjectTitle } from "@/lib/founder-os/titleQuality";
import { getValidationWorkspace } from "@/lib/founder-os/validationWorkspace.server";
import { buildValueProofReport } from "@/lib/founder-os/valueProof";
import { betaCohorts } from "@/lib/founder-os/coreLoop";
import { summarizeProof } from "@/lib/proof-board";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRelevantFounderReminders } from "@/lib/founder-learning/server";
import { getProjectPersonalization } from "@/lib/founder-intelligence/server";
import type { FounderIntelligenceProfile, PersonalizationContext } from "@/lib/founder-intelligence/types";
import { renameProjectTitle, updateProjectStatus } from "@/app/(app)/projects/actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string; chest?: string; reward?: string; rewardDescription?: string; levelUp?: string; section?: string }>;
}) {
  const [profile, routeParams, query, supabase] = await Promise.all([requireProfile(), params, searchParams, createClient()]);
  const { data: project, error } = await supabase
    .from("opportunity_projects")
    .select("*")
    .eq("id", routeParams.id)
    .eq("user_id", profile.id)
    .single();

  if (error || !project) {
    const { data: tombstone } = await supabase.from("deleted_project_tombstones").select("permanently_deleted_at").eq("project_id", routeParams.id).eq("user_id", profile.id).maybeSingle();
    if (!tombstone) notFound();
    return <section className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card"><p className="text-xs font-black uppercase tracking-[.16em] text-coral">Project permanently deleted</p><h1 className="mt-3 font-display text-3xl font-semibold text-ink">This project can no longer be recovered.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Its private project content was removed on {format(new Date(tombstone.permanently_deleted_at), "MMM d, yyyy")}. Sanitized account history may remain without the project content.</p><ButtonLink href="/projects" className="mt-5">Return to project library</ButtonLink></section>;
  }
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "project_opened", source: "project_detail", metadata: { status: project.status, score: project.score }, throttleSeconds: 15 * 60 });

  const reportCandidate = project.report_json as unknown;
  if (!isUsableOpportunityReport(reportCandidate)) {
    return (
      <div>
        <div className="mt-5">
          <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-ink/55 hover:text-ink">
            <ArrowLeft className="size-4" />
            Back to projects
          </Link>
        </div>

        <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-7 shadow-card">
          <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Project report unavailable</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">This project needs a fresh Founder OS report.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            The project exists, but its saved report data is missing one or more sections needed by the workspace. Create a fresh project report before continuing.
          </p>
        </section>
      </div>
    );
  }

  const [{ data: projectOutputs }, { data: validationExperiments }, { data: closureReflection }, { data: focus }] = await Promise.all([
    supabase
      .from("project_outputs")
      .select("*")
      .eq("project_id", project.id)
      .eq("user_id", profile.id),
    supabase
      .from("project_validation_experiments")
      .select("*")
      .eq("project_id", project.id)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_closure_reflections")
      .select("*")
      .eq("project_id", project.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(),
  ]);

  const report = reportCandidate;
  const savedOutputs = outputsByType((projectOutputs ?? []) as ProjectOutput[]);
  const proofExperiments = (validationExperiments ?? []) as ProjectValidationExperiment[];
  const proofSummary = summarizeProof(proofExperiments);
  const admin = createAdminClient();
  const [{ data: existingCoreFeedback, error: feedbackLookupError }, { data: recommendationEvent }] = await Promise.all([
    supabase
      .from("core_value_feedback")
      .select("id,rating,prompt_eligible_after")
      .eq("project_id", project.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    admin
      .from("app_events")
      .select("id")
      .eq("user_id", profile.id)
      .eq("event_name", "core_loop_recommendation_updated")
      .contains("metadata", { project_id: project.id })
      .limit(1)
      .maybeSingle(),
  ]);
  const feedbackCooldownActive = Boolean(existingCoreFeedback?.rating)
    || Boolean(existingCoreFeedback?.prompt_eligible_after && new Date(existingCoreFeedback.prompt_eligible_after).getTime() > Date.now());
  const canAskCoreValueFeedback = !feedbackLookupError
    && !feedbackCooldownActive
    && !project.is_synthetic
    && Boolean(recommendationEvent);
  if (canAskCoreValueFeedback) {
    await logBetaEvent({
      userId: profile.id,
      projectId: project.id,
      eventName: "core_loop_feedback_prompt_viewed",
      source: "project_detail",
      metadata: { trigger: "evidence_changed_recommendation" },
      throttleSeconds: 24 * 60 * 60,
    });
  }
  const status = project.status as ProjectStatus;
  const lifecycleStatus = project.lifecycle_status as ProjectLifecycleStatus;
  const businessType = project.business_type as BusinessType;
  const projectTitleRepair = cleanProjectTitle(project.title || report.summary.title, {
    audience: report.summary.targetCustomer || project.target_customer,
    painPoint: report.summary.painPoint,
    businessType,
    interests: report.input.interests,
    skills: report.input.skills,
    existingIdea: report.input.existingIdea,
  });
  const displayTitle = projectTitleRepair.title;
  if (projectTitleRepair.repaired) {
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "project_title_auto_repaired", source: "project_detail", metadata: { reason: projectTitleRepair.reason ?? "legacy_display_repair" }, throttleSeconds: 24 * 60 * 60 });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "legacy_invalid_title_detected", source: "project_detail", metadata: { reason: projectTitleRepair.reason ?? "legacy_display_repair" }, throttleSeconds: 24 * 60 * 60 });
  }
  const displayReport = { ...report, summary: { ...report.summary, title: displayTitle } };
  const displayProject = { ...project, title: displayTitle };
  const markdown = opportunityReportToMarkdown(displayReport);
  const sprintTasks = Array.isArray(savedOutputs.sprint_tasks) ? savedOutputs.sprint_tasks as unknown as SprintTaskOutput[] : undefined;
  const activeSection = parseProjectSection(query.section);
  const [validationWorkspaceBase, personalization] = await Promise.all([
    getValidationWorkspace({ userId: profile.id, projectId: project.id, report: displayReport, status, lifecycleStatus, deletedAt: project.deleted_at, proof: proofSummary, experiments: proofExperiments, outputs: (projectOutputs ?? []) as ProjectOutput[] }),
    getProjectPersonalization({ userId: profile.id, projectType: businessType, hoursPerWeek: displayReport.input.timePerWeek, externalEvidenceCount: proofSummary.replies + proofSummary.pain_confirmed + proofSummary.interested_users + proofSummary.waitlist_signups + proofSummary.payment_intent + (proofSummary.preorders_or_revenue_cents > 0 ? 1 : 0), status }),
  ]);
  const validationWorkspace = adaptValidationWorkspace(validationWorkspaceBase, personalization.profile.explicitPreferences.guidanceMode);
  const validationPath = validationWorkspace.route;
  const nextAction = completeNextBestActionDetail(getNextBestActionDetail({ status, sprintTasks, proof: proofSummary, report: displayReport, validationPath }));
  const currentAssumption = validationWorkspace.assumptions.find((item) => item.assumption_key === validationPath.targetAssumptionKey) ?? validationWorkspace.assumptions[0] ?? null;
  const nextActionHref = nextAction.href.startsWith("?") ? `/projects/${project.id}${nextAction.href.replace("section=plan", "section=project")}` : nextAction.href;
  const cohorts = betaCohorts({ businessType, projectCreatedAt: project.created_at, isSynthetic: Boolean(project.is_synthetic) });
  const historicalReminders = personalization.profile.explicitPreferences.historicalPersonalizationEnabled && personalization.profile.explicitPreferences.showHistoricalReminders
    ? await getRelevantFounderReminders(profile.id,{projectId:project.id,projectType:businessType,hoursPerWeek:displayReport.input.timePerWeek}) : [];
  if(historicalReminders.length)await Promise.all([
    logBetaEvent({userId:profile.id,projectId:project.id,eventName:"project_creation_history_reminder_shown",source:"project_detail",metadata:{reminder_count:historicalReminders.length,project_type:businessType},throttleSeconds:24*60*60}),
    logBetaEvent({userId:profile.id,projectId:project.id,eventName:"historical_reminder_shown",source:"project_detail",metadata:{reminder_count:historicalReminders.length,pattern_evidence_tier:personalization.context.relevantPatterns[0]?.evidenceTier??null,ai_used:false},throttleSeconds:24*60*60}),
  ]);
  if (personalization.context.relevantPatterns.length) await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "founder_pattern_used_in_guidance", source: "project_detail", metadata: { pattern_count: personalization.context.relevantPatterns.length, source_surface: "today", ai_used: false }, throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "project_workspace_loaded", source: "project_detail", metadata: { status, section: activeSection }, throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "next_best_action_loaded", source: "project_detail", metadata: { area: nextAction.area, status }, throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "project_section_viewed", source: "project_detail", metadata: { section: activeSection }, throttleSeconds: 5 * 60 });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "project_navigation_used", source: "project_detail", metadata: { section: activeSection }, throttleSeconds: 5 * 60 });
  if (activeSection === "today" || activeSection === "project") {
    await Promise.all([
      logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_summary_viewed", source: "project_detail", metadata: { section: activeSection, cohorts }, throttleSeconds: 15 * 60 }),
      logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_assumption_viewed", source: "project_detail", metadata: { section: activeSection, assumption_status: currentAssumption?.status ?? "untested", cohorts }, throttleSeconds: 15 * 60 }),
      logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_next_action_viewed", source: "project_detail", metadata: { section: activeSection, action_area: nextAction.area, cohorts }, throttleSeconds: 15 * 60 }),
    ]);
  }
  const projectAgeHours = (Date.now() - new Date(project.created_at).getTime()) / 3_600_000;
  if (!project.is_synthetic && projectAgeHours >= 24 && projectAgeHours < 48) await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_returned_next_day", source: "project_detail", metadata: { cohorts }, throttleSeconds: 24 * 60 * 60 });
  if (!project.is_synthetic && projectAgeHours >= 24 && projectAgeHours <= 7 * 24) await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_returned_within_seven_days", source: "project_detail", metadata: { cohorts }, throttleSeconds: 7 * 24 * 60 * 60 });
  if (activeSection === "validate") {
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "validate_opened", source: "project_detail", metadata: { section: activeSection }, throttleSeconds: 15 * 60 });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "proof_board_opened", source: "project_detail", metadata: { experiment_count: proofSummary.experiment_count, confidence_score: proofSummary.confidence_score }, throttleSeconds: 15 * 60 });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "validation_path_selected", source: "project_detail", metadata: { path: validationPath.key }, throttleSeconds: 15 * 60 });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "core_loop_support_opened", source: "project_detail", metadata: { support_type: validationPath.pathType, cohorts }, throttleSeconds: 15 * 60 });
  }
  if (activeSection === "launch") {
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "launch_opened", source: "project_detail", metadata: { section: activeSection }, throttleSeconds: 15 * 60 });
    await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "launch_command_center_opened", source: "project_detail", metadata: { status: project.status, proof_confidence_score: proofSummary.confidence_score }, throttleSeconds: 15 * 60 });
  }
  const topMvp = firstText(report.mvpPlan.mustHaveFeatures) ?? firstText(report.mvpPlan.featureList) ?? "Start with the smallest workflow users can test quickly.";
  const startingPoint = report.input.existingIdea || report.input.interests || "A rough founder idea";
  const fastestValidation = firstText(report.executionRoadmap.howToTestQuickly) ?? firstText(report.executionRoadmap.today) ?? "Contact 5 target users and ask what they already do instead.";
  const notBuildYet = firstText(report.mvpPlan.doNotBuildYet) ?? "Do not build advanced automation before validating the core pain.";
  const successThisWeek = firstText(report.executionRoadmap.thisWeek) ?? "Get 3 replies from real target users and decide whether the pain is strong enough to continue.";
  const valueProof = buildValueProofReport({ project: displayProject, report: displayReport, proof: proofSummary, experiments: proofExperiments, outputs: (projectOutputs ?? []) as ProjectOutput[] });
  if (activeSection === "project" || activeSection === "progress") {
    await logBetaEvent({
      userId: profile.id,
      projectId: project.id,
      eventName: "value_proof_card_viewed",
      source: "project_detail",
      metadata: {
        fundamentals_defined: valueProof.clarityDefinedCount,
        evidence_items: valueProof.evidenceItemCount,
        assumptions_tracked: valueProof.snapshot.assumptionsIdentified.length,
      },
      throttleSeconds: 15 * 60,
    });
  }

  return (
    <div className="project-workspace">
      <FormMessage message={query.message} type="success" />
      <FormMessage message={query.error} />

      <div>
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-ink/55 hover:text-ink">
          <ArrowLeft className="size-4" />
          Back to projects
        </Link>
      </div>

      <section className="surface relative mt-6 overflow-hidden p-6 sm:p-8" data-beta-project-title={displayTitle} data-beta-project-status={status}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-violet/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-moss/10 blur-3xl" />
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="relative min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusBadge status={status} />
              <LifecycleBadge status={lifecycleStatus} deletedAt={project.deleted_at} currentFocus={focus?.project_id === project.id} />
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink/55">{BUSINESS_TYPE_LABELS[businessType]}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink/55">
                <CalendarDays className="size-3.5" />
                Created {format(new Date(project.created_at), "MMM d, yyyy")}
              </span>
            </div>
            <h1 className="mt-5 break-words font-display text-4xl font-semibold tracking-[-.04em] text-ink sm:text-5xl">{displayTitle}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/60">{report.summary.oneSentenceIdea}</p>
            <Link href={`/projects/${project.id}/timeline`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet transition hover:text-ink"><History className="size-4" />View project timeline</Link>
          </div>
          <div className="relative rounded-2xl border border-ink/10 bg-cream/65 p-5 lg:w-72">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-ink/45">Current stage</p>
            <p className="mt-2 font-display text-2xl font-semibold capitalize text-ink">{status}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">{proofSummary.experiment_count ? `${proofSummary.experiment_count} evidence record${proofSummary.experiment_count === 1 ? "" : "s"}` : "No evidence recorded yet"}</p>
          </div>
        </div>
      </section>

      {(lifecycleStatus !== "active" || project.deleted_at) && <section className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${project.deleted_at ? "border-coral/25 bg-coral/10 text-ink" : "border-amber-200 bg-amber-50 text-amber-950"}`}><strong>{project.deleted_at ? "This project is in recovery." : `This project is ${lifecycleStatus}.`}</strong> {project.deleted_at ? `Restore it before active work. Recovery is available until ${project.recovery_expires_at ? format(new Date(project.recovery_expires_at), "MMM d, yyyy") : "the displayed recovery deadline"}.` : "Its stage, evidence, Value Proof, and history remain available. Restore or resume it before starting new work."}</section>}

      <ProjectSectionNav projectId={project.id} activeSection={activeSection} />

      {activeSection === "today" && (
        <>
          <SystemHeader
            eyebrow="Today"
            title="What should I do next?"
            description="This is the default workspace. Start here, do one real founder action, then come back when you have evidence."
          />
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(20rem,.82fr)_minmax(32rem,1.18fr)] [&>*]:mt-0">
            <BiggestQuestionCard
              projectId={project.id}
              assumptionId={currentAssumption?.id}
              statement={currentAssumption?.statement ?? validationPath.targetAssumption}
              status={currentAssumption?.status ?? "untested"}
              evidenceSummary={evidenceChangeSummary(proofExperiments[0], currentAssumption?.status)}
              nextActionHref={nextActionHref}
            />
            <TodayFocusCard projectId={project.id} nextAction={nextAction} status={status} proofSummary={proofSummary} historicalReminders={historicalReminders} intelligenceProfile={personalization.profile} personalizationContext={personalization.context} />
          </div>
          {canAskCoreValueFeedback && <CoreValueFeedback projectId={project.id} />}
        </>
      )}

      {activeSection === "project" && (
        <section className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,.7fr)]">
          <div className="surface p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="eyebrow">Project brief</p>
                <h2 className="mt-2 section-title">What are we building—and what are we not building yet?</h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-ink/60">The durable project definition, read from left to right. Today remains the place for one next action.</p>
              </div>
              <Link href={`/projects/${project.id}?section=today`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-violet/80 bg-violet px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#5649d7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
                Go to Today
              </Link>
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <InfoRow label="Starting point" value={startingPoint} />
              <InfoRow label="Structured project" value={report.summary.oneSentenceIdea} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoRow label="Who it is for" value={report.summary.targetCustomer} />
              <InfoRow label="Problem" value={report.summary.painPoint} />
              <InfoRow label="Smallest MVP" value={topMvp} />
              <InfoRow label="Fastest validation" value={fastestValidation} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <InfoRow label="Value proposition" value={report.summary.whyThisCouldMakeMoney} />
              <InfoRow label="Business model" value={report.summary.businessModel} />
              <InfoRow label="Do not build yet" value={notBuildYet} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <InfoRow label="Assumption to test first" value={report.marketValidation.underservedAngle} />
              <div className="rounded-2xl border border-moss/15 bg-lime/20 p-4">
                <p className="text-xs font-black uppercase tracking-[.14em] text-moss">Useful outcome this week</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">{successThisWeek}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/10 pt-6">
              <ButtonLink href={`/projects/${project.id}/export`} variant="secondary" className="gap-2"><ArrowDownToLine className="size-4" />Export markdown</ButtonLink>
              <CopySectionButton text={markdown} label="Copy full report" />
            </div>
          </div>

          <aside className="surface p-6">
            <ProjectTitleEditor projectId={project.id} title={displayTitle} action={renameProjectTitle} />
            <div className="mt-6"><ProjectStatusSelect projectId={project.id} status={status} suggestedStatus={validationPath.suggestedStage} disabled={lifecycleStatus !== "active" || Boolean(project.deleted_at)} action={updateProjectStatus} /></div>
            <div className="mt-6 rounded-2xl bg-cream/60 p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">Recent decisions</p>
              {validationWorkspace.decisions.length ? validationWorkspace.decisions.slice(0, 3).map((decision) => <p key={decision.id} className="mt-2 break-words text-sm font-semibold leading-6 text-ink/60"><span className="capitalize text-ink">{decision.decision_type.replaceAll("_", " ")}:</span> {decision.rationale}</p>) : <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">No evidence-based decision yet. Record one after a validation action.</p>}
              <Link href={`/projects/${project.id}/timeline`} className="mt-3 inline-flex text-xs font-black text-violet hover:text-ink">Open decision history</Link>
            </div>
            <div className="mt-6"><ProjectLifecycleControls projectId={project.id} title={displayTitle} lifecycleStatus={lifecycleStatus} lifecycleVersion={project.lifecycle_version} deletedAt={project.deleted_at} recoveryExpiresAt={project.recovery_expires_at} hasClosureReflection={Boolean(closureReflection)} /></div>
            <ProjectLearningControl projectId={project.id} excluded={Boolean(project.learning_excluded_at)} synthetic={Boolean(project.is_synthetic)} />
          </aside>
        </section>
      )}

      {activeSection === "validate" && (
        <>
          <SystemHeader
            eyebrow="Validate"
            title="How do I know this works?"
            description="Choose a validation path, log proof, and compare assumptions against real evidence. Outreach is optional, not forced."
          />
          <ValidationPathWorkspace projectId={project.id} {...validationWorkspace} />
          <BiggestQuestionCard
            projectId={project.id}
            assumptionId={currentAssumption?.id}
            statement={currentAssumption?.statement ?? validationPath.targetAssumption}
            status={currentAssumption?.status ?? "untested"}
            evidenceSummary={evidenceChangeSummary(proofExperiments[0], currentAssumption?.status)}
            nextActionHref="#proof-board"
          />
          <ProofBoard
            projectId={project.id}
            targetAudience={report.summary.targetCustomer || project.target_customer}
            painPoint={report.summary.painPoint}
            initialExperiments={proofExperiments}
            activePathId={validationWorkspace.activePath?.id}
            targetAssumptionId={validationWorkspace.assumptions.find((item) => item.assumption_key === validationPath.targetAssumptionKey)?.id}
            starterExperiment={validationPath.starterExperiment}
          />
          <details className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
            <summary className="cursor-pointer list-none">
              <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Validation options</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Open outreach, research, and experiment support.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">Use this when you are ready to contact people, test a landing page, run research, or compare assumptions.</p>
            </summary>
            <div className="mt-6 border-t border-ink/10 pt-6">
              <OutreachKit projectId={project.id} projectTitle={displayTitle} report={displayReport} />
            </div>
          </details>
          <ReportSectionCard kicker="Market validation" title="Validate before you build">
            <SectionHeaderCopy text={sectionText("Market validation", report.marketValidation)} />
            <div className="grid gap-5 md:grid-cols-2">
              <ListBlock title="Search demand assumptions" items={report.marketValidation.searchDemandAssumptions} />
              <ListBlock title="Social/content demand assumptions" items={report.marketValidation.socialDemandAssumptions} />
              <ListBlock title="Existing alternatives" items={report.marketValidation.existingAlternatives} />
              <ListBlock title="User complaints" items={report.marketValidation.userComplaints} />
            </div>
          </ReportSectionCard>
        </>
      )}

      {activeSection === "progress" && (
        <>
          <SystemHeader
            eyebrow="Progress"
            title="How am I progressing?"
            description="Review evidence, decisions, completed learning loops, and the project history without vanity activity."
          />
          <ValueProofCard projectId={project.id} valueProof={valueProof} />
          <section className="mt-6 rounded-[2rem] border border-violet/15 bg-white p-6 shadow-card">
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Validation path history</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Completed learning loops</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {validationWorkspace.history.filter((path) => path.status === "completed").length ? validationWorkspace.history.filter((path) => path.status === "completed").slice(0, 6).map((path) => <div key={path.id} className="rounded-2xl bg-lime/15 p-4"><p className="font-black capitalize text-ink">{path.path_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs leading-5 text-ink/55">{path.completion_requirement}</p></div>) : <p className="rounded-2xl bg-cream/60 p-4 text-sm text-ink/55 sm:col-span-2">Complete the active path by recording its required evidence. Preparation alone does not count as external proof.</p>}
            </div>
          </section>
          <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
            <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Founder progression</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Review the broader founder history.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">The Review page connects meaningful activity, recorded decisions, and cross-project learning in one place.</p>
            <div className="mt-5 flex flex-wrap gap-3"><ButtonLink href="/progress" variant="secondary">Open Review</ButtonLink><ButtonLink href={`/projects/${project.id}/timeline`} variant="ghost">Project history</ButtonLink></div>
          </section>
          <ProjectClosureReflectionCard projectId={project.id} initial={(closureReflection ?? null) as ProjectClosureReflection | null} />
        </>
      )}

      {activeSection === "launch" && (
        <>
          <SystemHeader
            eyebrow="Launch"
            title="Am I ready?"
            description="Use this only when you are preparing for private alpha, payment intent, tester invites, and launch readiness."
          />
          <FirstDollarSprint projectTitle={displayTitle} report={displayReport} proof={proofSummary} />
          <LaunchCommandCenter
            projectId={project.id}
            title={displayTitle}
            status={status}
            score={project.score}
            businessType={businessType}
            targetCustomer={project.target_customer}
            report={displayReport}
            sprintTasks={sprintTasks}
            validationProof={proofSummary}
            validationBlockers={validationPath.blockers}
          />
        </>
      )}

      {activeSection === "project" && (
      <details className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-5 shadow-card sm:p-6">
        <summary className="cursor-pointer list-none">
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Optional deep report</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Open the full strategy report.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            Keep this closed if you only need the project summary. Open it when you want market notes, pricing, content, landing page copy, and roadmap details.
          </p>
        </summary>

        <div className="mt-6 border-t border-ink/10 pt-6">
          <section className="rounded-[2rem] border border-violet/15 bg-white/80 p-6 shadow-card">
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Strategy report</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Reference the full report without extra buttons.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
              This section is intentionally informational. It preserves the original strategy without competing with Today or Validate.
            </p>
          </section>

          <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-ink/45">On larger screens, scroll sideways to read the report as a sequence.</p>
          <div className="project-report-rail mt-4 grid gap-6">
            <div className="project-report-panel grid gap-6 lg:grid-cols-[20rem_1fr]">
              <OpportunityScoreCard score={report.score} />
              <ReportSectionCard kicker="Business idea" title="What to build and why">
                <div className="grid gap-4 text-sm leading-7 text-ink/65">
                  <InfoRow label="Target customer" value={report.summary.targetCustomer} />
                  <InfoRow label="Pain point" value={report.summary.painPoint} />
                  <InfoRow label="Why now" value={report.summary.whyNow} />
                  <InfoRow label="Why this could make money" value={report.summary.whyThisCouldMakeMoney} />
                  <InfoRow label="Business model" value={report.summary.businessModel} />
                </div>
              </ReportSectionCard>
            </div>

            <div className="project-report-panel"><ReportSectionCard kicker="Market validation" title="Validate before you build">
              <SectionHeaderCopy text={sectionText("Market validation", report.marketValidation)} />
              <div className="grid gap-5 md:grid-cols-2">
                <ListBlock title="Search demand assumptions" items={report.marketValidation.searchDemandAssumptions} />
                <ListBlock title="Social/content demand assumptions" items={report.marketValidation.socialDemandAssumptions} />
                <ListBlock title="Existing alternatives" items={report.marketValidation.existingAlternatives} />
                <ListBlock title="User complaints" items={report.marketValidation.userComplaints} />
              </div>
              <div className="mt-5 rounded-2xl border border-moss/15 bg-lime/25 p-5">
                <p className="font-bold text-moss">Underserved angle</p>
                <p className="mt-2 leading-7 text-ink/65">{report.marketValidation.underservedAngle}</p>
              </div>
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="Competitors" title="Competitor analysis">
              <SectionHeaderCopy text={sectionText("Competitors", report.competitors)} />
              <CompetitorTable competitors={report.competitors} />
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="MVP" title="MVP builder">
              <SectionHeaderCopy text={sectionText("MVP", report.mvpPlan)} />
              <MvpPlanCard plan={report.mvpPlan} />
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="Money" title="Monetization plan">
              <SectionHeaderCopy text={sectionText("Monetization", report.monetizationPlan)} />
              <MonetizationCard plan={report.monetizationPlan} />
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="Distribution" title="Content engine">
              <SectionHeaderCopy text={sectionText("Content", report.contentPlan)} />
              <ContentIdeasGrid plan={report.contentPlan} />
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="Landing page" title="Landing page copy">
              <SectionHeaderCopy text={sectionText("Landing page", report.landingPageCopy)} />
              <LandingPagePreview copy={report.landingPageCopy} />
            </ReportSectionCard></div>

            <div className="project-report-panel"><ReportSectionCard kicker="Execution" title="Founder roadmap">
              <SectionHeaderCopy text={sectionText("Roadmap", report.executionRoadmap)} />
              <RoadmapTimeline roadmap={report.executionRoadmap} />
            </ReportSectionCard></div>
          </div>
        </div>
      </details>
      )}
    </div>
  );
}

function ProjectSectionNav({ projectId, activeSection }: { projectId: string; activeSection: ProjectSection }) {
  return (
    <nav className="sticky top-3 z-10 mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-white/90 p-2 shadow-card backdrop-blur" aria-label="Project workspace sections">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PROJECT_SECTIONS.map((section) => {
          const active = section.id === activeSection;
          return (
            <Link
              key={section.id}
              href={`/projects/${projectId}?section=${section.id}`}
              aria-current={active ? "page" : undefined}
              className={`min-w-[10rem] flex-1 rounded-xl px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 hover:-translate-y-0.5 hover:shadow-sm ${
                active ? "bg-ink text-white" : "bg-cream/60 text-ink hover:bg-white"
              }`}
            >
              <span className="block text-sm font-black">{section.label}</span>
              <span className={`mt-1 block text-xs font-semibold ${active ? "text-white/65" : "text-ink/45"}`}>{section.description}</span>
              <span className={`mt-2 hidden text-[11px] font-semibold leading-4 xl:block ${active ? "text-white/55" : "text-ink/35"}`}>{section.question}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SystemHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <p className="text-xs font-black uppercase tracking-[.16em] text-violet">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">{description}</p>
    </section>
  );
}

function TodayFocusCard({
  projectId,
  nextAction,
  status,
  proofSummary,
  historicalReminders,
  intelligenceProfile,
  personalizationContext,
}: {
  projectId: string;
  nextAction: NextBestActionDetail;
  status: ProjectStatus;
  proofSummary: ReturnType<typeof summarizeProof>;
  historicalReminders: Awaited<ReturnType<typeof getRelevantFounderReminders>>;
  intelligenceProfile: FounderIntelligenceProfile;
  personalizationContext: PersonalizationContext;
}) {
  const href = nextAction.href.startsWith("?") ? `/projects/${projectId}${nextAction.href.replace("section=plan", "section=project")}` : nextAction.href;
  const validationStage = proofSummary.experiment_count === 0
    ? "No evidence logged yet"
    : `${proofSummary.confidence_label} · ${proofSummary.experiment_count} experiment${proofSummary.experiment_count === 1 ? "" : "s"}`;

  const showReasons = intelligenceProfile.explicitPreferences.showPersonalizationReasons;

  return (
    <section id="next-best-action" className="mt-6 overflow-hidden rounded-[2rem] border border-moss/15 bg-gradient-to-br from-white via-lime/20 to-gold/20 p-6 shadow-card">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Next Best Action</p>
          <h2 className="mt-3 max-w-4xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{nextAction.action}</h2>
          <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-white/85 p-4 text-sm leading-6 text-ink/70">
            <p><span className="font-black text-ink">Why this matters:</span> {nextAction.why}</p>
            <p><span className="font-black text-ink">Estimated effort:</span> {nextAction.estimatedTime}</p>
            {nextAction.doneWhen && <p><span className="font-black text-ink">Done when:</span> {nextAction.doneWhen}</p>}
            {nextAction.evidenceToRecord && <p><span className="font-black text-ink">Evidence to record:</span> {nextAction.evidenceToRecord}</p>}
            {nextAction.afterCompletion && <p><span className="font-black text-ink">What happens next:</span> {nextAction.afterCompletion}</p>}
          </div>
          {showReasons && (
            <details className="mt-4 rounded-2xl border border-violet/15 bg-white/80 p-4 text-sm text-ink/65">
              <summary className="cursor-pointer font-black text-violet">Why this recommendation?</summary>
              <p className="mt-3 leading-6">Current project status, active validation path, evidence, and founder constraints are considered first.</p>
              {personalizationContext.relevantPatterns.map((pattern) => <p key={pattern.patternId} className="mt-2 leading-6"><span className="font-black text-ink">Historical context:</span> {pattern.headline}</p>)}
              {!personalizationContext.relevantPatterns.length && <p className="mt-2 leading-6">No comparable historical pattern changed this recommendation.</p>}
              <p className="mt-2 text-xs leading-5 text-ink/45">Historical observations are correlations, not predictions. A new project must earn its own evidence.</p>
            </details>
          )}
          <TrackedCoreActionLink projectId={projectId} href={href}>Start with guided support</TrackedCoreActionLink>
          <HistoricalLearningReminder reminders={historicalReminders} />
        </div>
        <aside className="rounded-[1.5rem] border border-ink/10 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">Current milestone</p>
          <p className="mt-2 font-display text-2xl font-semibold capitalize text-ink">{status}</p>
          <div className="mt-5 rounded-2xl bg-cream/65 p-4">
            <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">Validation stage</p>
            <p className="mt-2 text-sm font-bold leading-6 text-ink/70">{validationStage}</p>
          </div>
          <div className="mt-5 rounded-2xl bg-cream/65 p-4">
            <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">Opens</p>
            <p className="mt-2 text-sm font-bold leading-6 text-ink/70">{nextAction.area}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream/45 p-4">
      <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
      <p className="mt-2">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

function SectionHeaderCopy({ text }: { text: string }) {
  return (
    <div className="-mt-1 mb-4 flex justify-end">
      <CopySectionButton text={text} label="Copy section" />
    </div>
  );
}

function sectionText(title: string, value: unknown) {
  return `${title}\n\n${JSON.stringify(value, null, 2)}`;
}

function firstText(value: unknown) {
  return Array.isArray(value) ? value.find((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;
}

function evidenceChangeSummary(experiment?: ProjectValidationExperiment, assumptionStatus?: string | null) {
  if (!experiment) return null;
  const evidenceLabel = experiment.evidence_type.replaceAll("_", " ");
  const status = assumptionStatus ?? "inconclusive";
  if (status === "supported") return `The latest ${evidenceLabel} adds support to this assumption. PrismForge still treats it as evidence-qualified, not proven.`;
  if (status === "contradicted") return `The latest ${evidenceLabel} did not show the expected signal. The recommendation now favors revising or narrowing the test.`;
  return `The latest ${evidenceLabel} is saved, but the result remains inconclusive. The next action focuses on collecting a clearer signal.`;
}

function outputsByType(outputs: ProjectOutput[]) {
  return outputs.reduce((acc, output) => {
    acc[output.output_type] = output.content_json;
    return acc;
  }, {} as Partial<Record<ProjectOutputType, ProjectOutput["content_json"]>>);
}

function isUsableOpportunityReport(value: unknown): value is OpportunityReport {
  if (!isRecord(value)) return false;

  const score = value.score;
  const summary = value.summary;
  const marketValidation = value.marketValidation;
  const mvpPlan = value.mvpPlan;
  const monetizationPlan = value.monetizationPlan;
  const contentPlan = value.contentPlan;
  const landingPageCopy = value.landingPageCopy;
  const executionRoadmap = value.executionRoadmap;

  return (
    isRecord(score) &&
    hasFiniteNumber(score, "overall") &&
    hasFiniteNumber(score, "demand") &&
    hasFiniteNumber(score, "competition") &&
    hasFiniteNumber(score, "monetization") &&
    hasFiniteNumber(score, "easeOfMvp") &&
    hasFiniteNumber(score, "virality") &&
    hasFiniteNumber(score, "founderFit") &&
    hasFiniteNumber(score, "recurringRevenue") &&
    Array.isArray(score.breakdown) &&
    isRecord(summary) &&
    hasString(summary, "title") &&
    hasString(summary, "oneSentenceIdea") &&
    hasString(summary, "targetCustomer") &&
    hasString(summary, "painPoint") &&
    hasString(summary, "whyNow") &&
    hasString(summary, "whyThisCouldMakeMoney") &&
    hasString(summary, "businessModel") &&
    isRecord(marketValidation) &&
    hasStringArray(marketValidation, "searchDemandAssumptions") &&
    hasStringArray(marketValidation, "socialDemandAssumptions") &&
    hasStringArray(marketValidation, "existingAlternatives") &&
    hasStringArray(marketValidation, "userComplaints") &&
    hasString(marketValidation, "underservedAngle") &&
    Array.isArray(value.competitors) &&
    isRecord(mvpPlan) &&
    hasStringArray(mvpPlan, "featureList") &&
    hasStringArray(mvpPlan, "mustHaveFeatures") &&
    hasStringArray(mvpPlan, "niceToHaveFeatures") &&
    hasStringArray(mvpPlan, "doNotBuildYet") &&
    hasStringArray(mvpPlan, "suggestedStack") &&
    hasStringArray(mvpPlan, "sevenDayBuildPlan") &&
    hasStringArray(mvpPlan, "thirtyDayLaunchPlan") &&
    isRecord(monetizationPlan) &&
    hasStringArray(monetizationPlan, "freeTier") &&
    hasStringArray(monetizationPlan, "premiumTier") &&
    hasString(monetizationPlan, "suggestedPrice") &&
    Array.isArray(monetizationPlan.tierFeatureMap) &&
    hasString(monetizationPlan, "upsellStrategy") &&
    hasString(monetizationPlan, "whyUsersWouldPay") &&
    isRecord(contentPlan) &&
    hasStringArray(contentPlan, "shortFormHooks") &&
    Array.isArray(contentPlan.videoScripts) &&
    hasStringArray(contentPlan, "tweetIdeas") &&
    hasStringArray(contentPlan, "redditAngles") &&
    hasStringArray(contentPlan, "seoArticleTitles") &&
    hasString(contentPlan, "shockValueAngle") &&
    hasString(contentPlan, "educationalAngle") &&
    hasString(contentPlan, "buildingInPublicAngle") &&
    isRecord(landingPageCopy) &&
    hasString(landingPageCopy, "heroHeadline") &&
    hasString(landingPageCopy, "subheadline") &&
    hasString(landingPageCopy, "cta") &&
    hasStringArray(landingPageCopy, "benefitBullets") &&
    Array.isArray(landingPageCopy.faq) &&
    hasString(landingPageCopy, "pricingSectionCopy") &&
    isRecord(executionRoadmap) &&
    hasStringArray(executionRoadmap, "today") &&
    hasStringArray(executionRoadmap, "thisWeek") &&
    hasStringArray(executionRoadmap, "thisMonth") &&
    hasStringArray(executionRoadmap, "first100UsersPlan") &&
    hasStringArray(executionRoadmap, "first1000RevenuePlan") &&
    hasStringArray(executionRoadmap, "biggestRisks") &&
    hasStringArray(executionRoadmap, "howToTestQuickly")
  );
}

function adaptValidationWorkspace<T extends { route: { alternatives: unknown[] } }>(workspace: T, mode: "guided" | "balanced" | "autonomous"): T {
  const limit = mode === "guided" ? 1 : mode === "balanced" ? 2 : workspace.route.alternatives.length;
  return { ...workspace, route: { ...workspace.route, alternatives: workspace.route.alternatives.slice(0, limit) } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" && record[key].trim().length > 0;
}

function hasFiniteNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key]);
}

function hasStringArray(record: Record<string, unknown>, key: string) {
  return Array.isArray(record[key]) && record[key].every((item) => typeof item === "string");
}
