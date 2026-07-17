import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  Gauge,
  MailWarning,
  MessageSquareText,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { AppEvent, EmailDeliveryLog, EmailQueue, FeatureUsageEvent, Json, OpportunityProject, Profile, ProgressionFlag, ProjectValidationExperiment, RateLimitBucket, UserXp, XpEvent } from "@/lib/database.types";
import { getEffectivePlan, isTemporaryBetaFounder } from "@/lib/billing/planLimits";
import type { OpportunityReport } from "@/lib/founder-os/types";
import { scoreEvidence, scoreProjectClarity } from "@/lib/founder-os/valueProof";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Beta Monitoring" };
export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type QueryError = { message?: string } | null;
type CountQuery = PromiseLike<{ count: number | null; error: QueryError }>;
type RowsQuery<T> = PromiseLike<{ data: T[] | null; error: QueryError }>;

const aiSources = ["openai", "cache", "fallback", "blocked"] as const;
const coreAiFeatures = ["ceo_ai", "marketer_ai", "designer_ai", "engineer_ai", "validation_survey", "competitive_battlecard", "pricing_tiers", "video_scripts", "sprint_tasks"] as const;
const founderLoopEvents = [
  "core_loop_project_created",
  "core_loop_summary_viewed",
  "core_loop_assumption_viewed",
  "core_loop_next_action_viewed",
  "core_loop_next_action_started",
  "core_loop_support_opened",
  "core_loop_evidence_saved",
  "core_loop_recommendation_updated",
  "core_loop_completed",
  "core_loop_feedback_submitted",
] as const;

export default async function MonitoringPage() {
  const supabase = await createClient();
  const db = supabase as any;
  const issues: string[] = [];
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    newUsers7d,
    totalProjects,
    projects7d,
    deletionRequests,
    emailQueueFailed,
    emailDeliveryFailed,
    emailQueueWaiting,
    rateLimitBucketCount,
  ] = await Promise.all([
    safeCount("total users", db.from("profiles").select("*", { count: "exact", head: true }), issues),
    safeCount("new users 7d", db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo), issues),
    safeCount("projects", db.from("opportunity_projects").select("*", { count: "exact", head: true }), issues),
    safeCount("projects 7d", db.from("opportunity_projects").select("*", { count: "exact", head: true }).gte("created_at", weekAgo), issues),
    safeCount("account deletion requests", db.from("account_deletion_requests").select("*", { count: "exact", head: true }).eq("status", "requested"), issues),
    safeCount("failed queued emails", db.from("email_queue").select("*", { count: "exact", head: true }).eq("status", "failed"), issues),
    safeCount("failed delivery logs", db.from("email_delivery_logs").select("*", { count: "exact", head: true }).eq("status", "failed"), issues),
    safeCount("waiting queued emails", db.from("email_queue").select("*", { count: "exact", head: true }).in("status", ["queued", "sending"]), issues),
    safeCount("rate limit buckets", db.from("rate_limit_buckets").select("*", { count: "exact", head: true }), issues),
  ]);

  const [
    profiles,
    projects,
    proofRows,
    appEvents,
    featureUsageEvents,
    userXpRows,
    xpEvents,
    progressionFlags,
    emailQueue,
    emailLogs,
    rateLimitBuckets,
  ] = await Promise.all([
    safeRows<Pick<Profile, "id" | "email" | "name" | "plan" | "beta_access_until" | "lifetime_founder" | "beta_feedback_completed" | "created_at" | "updated_at">>(
      "profiles",
      db.from("profiles").select("id,email,name,plan,beta_access_until,lifetime_founder,beta_feedback_completed,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
      issues,
    ),
    safeRows<Pick<OpportunityProject, "id" | "user_id" | "title" | "business_type" | "target_customer" | "score" | "status" | "report_json" | "created_at" | "updated_at">>(
      "projects",
      db.from("opportunity_projects").select("id,user_id,title,business_type,target_customer,score,status,report_json,created_at,updated_at").order("updated_at", { ascending: false }).limit(2500),
      issues,
    ),
    safeRows<ProjectValidationExperiment>(
      "proof board experiments",
      db.from("project_validation_experiments").select("*").order("updated_at", { ascending: false }).limit(2500),
      issues,
    ),
    safeRows<AppEvent>("app events", db.from("app_events").select("*").order("created_at", { ascending: false }).limit(2500), issues),
    safeRows<FeatureUsageEvent>("feature usage events", db.from("feature_usage_events").select("*").order("created_at", { ascending: false }).limit(2500), issues),
    safeRows<Pick<UserXp, "user_id" | "total_xp" | "level" | "title" | "updated_at">>(
      "user xp",
      db.from("user_xp").select("user_id,total_xp,level,title,updated_at").order("total_xp", { ascending: false }).limit(1000),
      issues,
    ),
    safeRows<Pick<XpEvent, "id" | "user_id" | "project_id" | "action" | "xp_delta" | "awarded_xp" | "verification_level" | "source_type" | "source_id" | "event_status" | "reason" | "created_at">>(
      "xp events",
      db.from("xp_events").select("id,user_id,project_id,action,xp_delta,awarded_xp,verification_level,source_type,source_id,event_status,reason,created_at").order("created_at", { ascending: false }).limit(2500),
      issues,
    ),
    safeRows<ProgressionFlag>("progression flags", db.from("progression_flags").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(100), issues),
    safeRows<Pick<EmailQueue, "id" | "recipient" | "subject" | "email_type" | "status" | "attempts" | "last_error" | "created_at">>(
      "email queue",
      db.from("email_queue").select("id,recipient,subject,email_type,status,attempts,last_error,created_at").order("created_at", { ascending: false }).limit(12),
      issues,
    ),
    safeRows<Pick<EmailDeliveryLog, "id" | "recipient" | "email_type" | "status" | "error_message" | "created_at">>(
      "email delivery logs",
      db.from("email_delivery_logs").select("id,recipient,email_type,status,error_message,created_at").order("created_at", { ascending: false }).limit(12),
      issues,
    ),
    safeRows<RateLimitBucket>("rate limit buckets", db.from("rate_limit_buckets").select("*").order("updated_at", { ascending: false }).limit(12), issues),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const usersWithProjects = unique(projects.map((project) => project.user_id));
  const proofUsers = unique([...proofRows.map((row) => row.user_id), ...appEvents.filter((event) => event.event_name === "proof_experiment_created").map((event) => event.user_id).filter(Boolean) as string[]]);
  const feedbackUsers = unique([
    ...profiles.filter((profile) => profile.beta_feedback_completed).map((profile) => profile.id),
    ...appEvents.filter((event) => event.event_name === "beta_feedback_submitted").map((event) => event.user_id).filter(Boolean) as string[],
  ]);
  const activeUsers7d = unique([
    ...projects.filter((project) => project.updated_at >= weekAgo).map((project) => project.user_id),
    ...proofRows.filter((row) => row.updated_at >= weekAgo).map((row) => row.user_id),
    ...featureUsageEvents.filter((event) => event.created_at >= weekAgo).map((event) => event.user_id).filter(Boolean) as string[],
    ...appEvents.filter((event) => event.created_at >= weekAgo).map((event) => event.user_id).filter(Boolean) as string[],
  ]);
  const returnedNextDayUsers = countReturnedUsers(profiles, appEvents, 1);
  const returnedNextWeekUsers = countReturnedUsers(profiles, appEvents, 7);
  const totalAiCalls = featureUsageEvents.length;
  const openAiCalls = featureUsageEvents.filter((event) => event.source === "openai").length;
  const aiBySource = Object.fromEntries(aiSources.map((source) => [source, featureUsageEvents.filter((event) => event.source === source).length])) as Record<(typeof aiSources)[number], number>;
  const aiByFeature = coreAiFeatures.map((feature) => ({
    feature,
    count: featureUsageEvents.filter((event) => event.feature === feature).length,
    users: unique(featureUsageEvents.filter((event) => event.feature === feature).map((event) => event.user_id).filter(Boolean) as string[]).length,
  }));
  const proofSummary = summarizeProof(proofRows);
  const valueOutcomeRows = projects
    .map((project) => {
      const report = isOpportunityReport(project.report_json) ? project.report_json : null;
      const projectProofRows = proofRows.filter((row) => row.project_id === project.id);
      const projectProof = summarizeProof(projectProofRows);
      return report
        ? {
            project,
            clarity: scoreTo100(scoreProjectClarity(report)),
            evidence: scoreTo100(scoreEvidence(projectProof, projectProofRows)),
            proof: projectProof,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const averageClarityScore = averageNumber(valueOutcomeRows.map((row) => row.clarity));
  const averageEvidenceScore = averageNumber(valueOutcomeRows.map((row) => row.evidence));
  const copiedValueProofUsers = unique(appEvents.filter((event) => event.event_name === "value_summary_copied").map((event) => event.user_id).filter(Boolean) as string[]);
  const eventCounts = founderLoopEvents.map((eventName) => ({ eventName, count: appEvents.filter((event) => event.event_name === eventName).length }));
  const xpEvents7d = xpEvents.filter((event) => event.created_at >= weekAgo);
  const averageFounderLevel = userXpRows.length ? (userXpRows.reduce((sum, row) => sum + Number(row.level ?? 1), 0) / userXpRows.length).toFixed(1) : "0";
  const topXpActions = summarizeXpActions(xpEvents);
  const topProgressUsers = userXpRows.slice(0, 10);
  const generationAttempts = summarizeGenerationAttempts(appEvents, profileById);
  const authDiagnostics = appEvents
    .filter((event) => ["landing_auth_state_rendered", "start_creating_route_selected", "auth_redirect_triggered", "profile_repair_attempted", "auth_state_mismatch_detected"].includes(event.event_name))
    .slice(0, 20);
  const funnel = [
    { label: "Signed up", count: totalUsers },
    { label: "Created project", count: uniqueEventUsers(appEvents, "core_loop_project_created", usersWithProjects.length) },
    { label: "Viewed biggest question", count: uniqueEventUsers(appEvents, "core_loop_assumption_viewed") },
    { label: "Started next action", count: uniqueEventUsers(appEvents, "core_loop_next_action_started") },
    { label: "Recorded evidence", count: uniqueEventUsers(appEvents, "core_loop_evidence_saved", proofUsers.length) },
    { label: "Recommendation updated", count: uniqueEventUsers(appEvents, "core_loop_recommendation_updated") },
    { label: "Completed core loop", count: uniqueEventUsers(appEvents, "core_loop_completed") },
    { label: "Returned next day", count: returnedNextDayUsers },
    { label: "Submitted feedback", count: feedbackUsers.length },
  ];
  const betaUsers = profiles.map((profile) => userBetaRow(profile, projects, proofRows, featureUsageEvents, appEvents)).sort((a, b) => b.lastActiveTime - a.lastActiveTime).slice(0, 25);
  const healthWarnings = [
    ...(emailQueueFailed ? [`${emailQueueFailed} queued email${emailQueueFailed === 1 ? "" : "s"} failed`] : []),
    ...(emailDeliveryFailed ? [`${emailDeliveryFailed} delivery log${emailDeliveryFailed === 1 ? "" : "s"} failed`] : []),
    ...(deletionRequests ? [`${deletionRequests} open account deletion request${deletionRequests === 1 ? "" : "s"}`] : []),
    ...(issues.length ? [`${issues.length} monitoring quer${issues.length === 1 ? "y" : "ies"} failed`] : []),
  ];

  return (
    <div>
      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <Activity className="size-4" />
            Admin beta monitoring
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">PrismForge beta control room</h1>
          <p className="mt-3 max-w-3xl text-ink/60">
            Track whether testers complete the founder loop: generate a project, open it, use one AI tool, log proof, return, and send feedback.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-md">Back to admin</Link>
          <Link href="/dashboard" className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-moss hover:shadow-md">User dashboard</Link>
        </div>
      </div>

      <section className={`mt-8 rounded-[1.5rem] border p-5 ${healthWarnings.length ? "border-amber-200 bg-amber-50 text-amber-950" : "border-green-200 bg-green-50 text-green-950"}`}>
        <div className="flex items-start gap-3">
          {healthWarnings.length ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700" />}
          <div>
            <p className="font-bold">{healthWarnings.length ? "Needs attention" : "Core beta systems look calm"}</p>
            <div className="mt-2 grid gap-1 text-sm leading-6">
              {healthWarnings.length ? healthWarnings.map((warning) => <p key={warning}>{warning}</p>) : <p>No failed email queues, account-deletion requests, or monitoring query errors detected.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} label="Total users" value={totalUsers} detail={`${newUsers7d} new in 7 days · ${activeUsers7d.length} active this week`} tone="sky" />
        <StatCard icon={<DatabaseZap className="size-5" />} label="Projects generated" value={totalProjects} detail={`${projects7d} new in 7 days · ${percent(usersWithProjects.length, totalUsers)} user conversion`} tone="lime" />
        <StatCard icon={<Bot className="size-5" />} label="OpenAI calls" value={openAiCalls} detail={`${aiBySource.cache} cache · ${aiBySource.fallback} fallback · ${aiBySource.blocked} blocked`} tone={aiBySource.blocked ? "amber" : "violet"} />
        <StatCard icon={<Target className="size-5" />} label="Proof confidence" value={`${proofSummary.confidence_score}/100`} detail={`${proofSummary.experiment_count} experiments · ${proofSummary.people_contacted} contacted · ${money.format(proofSummary.preorders_or_revenue_cents / 100)} revenue`} tone="gold" />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={<Gauge className="size-5" />} label="AI calls / active user" value={average(totalAiCalls, Math.max(1, activeUsers7d.length))} detail="Includes OpenAI, cache, local fallback, and blocked usage events." tone="cream" />
        <StatCard icon={<MessageSquareText className="size-5" />} label="Feedback signals" value={feedbackUsers.length} detail={`${profiles.filter((profile) => profile.beta_feedback_completed).length} marked completed · ${eventCount(appEvents, "beta_feedback_opened")} opened`} tone="cream" />
        <StatCard icon={<MailWarning className="size-5" />} label="Email queue" value={emailQueueWaiting} detail={`${emailQueueFailed} failed queued · ${emailDeliveryFailed} failed delivery logs`} tone={emailQueueFailed || emailDeliveryFailed ? "amber" : "green"} />
      </section>

      <Section title="Founder loop funnel" kicker="Beta conversion" icon={<BarChart3 className="size-5" />}>
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">Step</th><th className="px-4 py-3">Users</th><th className="px-4 py-3">From signup</th><th className="px-4 py-3">From previous</th><th className="px-4 py-3">Visual</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {funnel.map((step, index) => {
                  const previous = index === 0 ? step.count : funnel[index - 1]?.count ?? 0;
                  return (
                    <tr key={step.label}>
                      <td className="px-4 py-3 font-bold">{step.label}</td>
                      <td className="px-4 py-3">{number.format(step.count)}</td>
                      <td className="px-4 py-3">{percent(step.count, totalUsers)}</td>
                      <td className="px-4 py-3">{index === 0 ? "—" : percent(step.count, previous)}</td>
                      <td className="px-4 py-3"><ProgressBar value={totalUsers ? (step.count / totalUsers) * 100 : 0} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Feature value signals" kicker="What testers actually use" icon={<Zap className="size-5" />}>
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel title="AI usage by feature">
            <div className="grid gap-3 p-5">
              {aiByFeature.map((item) => <ProgressRow key={item.feature} label={humanize(item.feature)} value={item.count} detail={`${item.users} user${item.users === 1 ? "" : "s"}`} max={Math.max(1, ...aiByFeature.map((feature) => feature.count))} />)}
            </div>
          </Panel>
          <Panel title="Founder loop events">
            <div className="grid gap-3 p-5">
              {eventCounts.map((item) => <ProgressRow key={item.eventName} label={humanize(item.eventName)} value={item.count} max={Math.max(1, ...eventCounts.map((event) => event.count))} />)}
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Project generation diagnostics" kicker="Find failed/stalled first-project attempts" icon={<Activity className="size-5" />}>
        <Panel title="Recent generation attempts" empty={generationAttempts.length === 0 ? "No generation diagnostics recorded yet." : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">Tester</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Error</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">When</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {generationAttempts.map((attempt) => (
                  <tr key={attempt.requestId}>
                    <td className="px-4 py-3"><p className="font-bold">{attempt.userName}</p><p className="text-xs text-ink/45">{attempt.userEmail}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-ink/55">{attempt.requestId.slice(0, 8)}…</td>
                    <td className="px-4 py-3"><StatusBadge status={attempt.status} /></td>
                    <td className="px-4 py-3 font-bold">{humanize(attempt.stage)}</td>
                    <td className="px-4 py-3">{attempt.source ?? "—"}</td>
                    <td className="px-4 py-3">{attempt.durationMs ? `${attempt.durationMs}ms` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink/55">{attempt.errorCategory ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink/45">{attempt.projectId ? `${attempt.projectId.slice(0, 8)}…` : "—"}</td>
                    <td className="px-4 py-3 text-ink/55">{formatAgo(attempt.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Auth and Start Creating diagnostics" kicker="Landing state vs route guard" icon={<ShieldCheck className="size-5" />}>
        <Panel title="Recent auth routing events" empty={authDiagnostics.length === 0 ? "No auth routing diagnostics yet." : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Tester</th><th className="px-4 py-3">Authenticated</th><th className="px-4 py-3">Profile</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Error</th><th className="px-4 py-3">When</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {authDiagnostics.map((event) => {
                  const metadata = asMetadata(event.metadata);
                  const profile = event.user_id ? profileById.get(event.user_id) : null;
                  return (
                    <tr key={event.id}>
                      <td className="px-4 py-3 font-bold">{humanize(event.event_name)}</td>
                      <td className="px-4 py-3 text-xs text-ink/55">{profile?.email ? maskEmail(profile.email) : "anonymous"}</td>
                      <td className="px-4 py-3">{String(metadata.authenticated ?? "unknown")}</td>
                      <td className="px-4 py-3">{String(metadata.profile_exists ?? "unknown")}</td>
                      <td className="px-4 py-3 text-xs text-ink/55">{stringValue(metadata.target_route) ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-ink/55">{stringValue(metadata.error_category) ?? stringValue(metadata.reason) ?? "—"}</td>
                      <td className="px-4 py-3 text-ink/55">{formatAgo(event.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Proof Board and payment-interest signal" kicker="Evidence, not assumptions" icon={<ClipboardList className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-4">
          <MiniMetric label="Experiments" value={proofSummary.experiment_count} />
          <MiniMetric label="People contacted" value={proofSummary.people_contacted} />
          <MiniMetric label="Pain confirmed" value={proofSummary.pain_confirmed} />
          <MiniMetric label="Payment intent" value={proofSummary.payment_intent} />
        </div>
        <Panel title="Recent validation experiments" empty={proofRows.length === 0 ? "No Proof Board experiments yet." : undefined} className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">Experiment</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Contacted</th><th className="px-4 py-3">Replies</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Updated</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {proofRows.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3"><p className="max-w-[300px] truncate font-bold">{row.title}</p><p className="text-xs text-ink/45">{row.channel ?? "No channel"}</p></td>
                    <td className="px-4 py-3 text-xs text-ink/55">{maskEmail(profileById.get(row.user_id)?.email ?? row.user_id)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">{row.people_contacted}</td>
                    <td className="px-4 py-3">{row.replies}</td>
                    <td className="px-4 py-3">{row.payment_intent}</td>
                    <td className="px-4 py-3 text-ink/55">{formatAgo(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Founder progress health" kicker="XP, levels, quests" icon={<Trophy className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MiniMetric label="Tracked users" value={userXpRows.length} />
          <MiniMetric label="Average level" value={Number(averageFounderLevel)} />
          <MiniMetric label="XP events 7d" value={xpEvents7d.length} />
          <MiniMetric label="XP awarded 7d" value={xpEvents7d.reduce((sum, event) => sum + Number(event.xp_delta ?? 0), 0)} />
          <MiniMetric label="Duplicates stopped" value={appEvents.filter((event) => event.event_name === "xp_event_duplicate_prevented").length} />
          <MiniMetric label="Open review flags" value={progressionFlags.length} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          <Panel title="Top XP actions" empty={topXpActions.length === 0 ? "No XP events recorded yet." : undefined}>
            <div className="grid gap-3 p-5">
              {topXpActions.map((item) => <ProgressRow key={item.action} label={humanize(item.action)} value={item.count} detail={`${number.format(item.xp)} XP`} max={Math.max(1, ...topXpActions.map((action) => action.count))} />)}
            </div>
          </Panel>
          <Panel title="Top founder levels" empty={topProgressUsers.length === 0 ? "No level rows yet." : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                  <tr><th className="px-4 py-3">Tester</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">XP</th><th className="px-4 py-3">Updated</th></tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {topProgressUsers.map((row) => {
                    const profile = profileById.get(row.user_id);
                    return (
                      <tr key={row.user_id}>
                        <td className="px-4 py-3"><p className="font-bold">{profile?.name || "Unnamed tester"}</p><p className="text-xs text-ink/45">{maskEmail(profile?.email ?? row.user_id)}</p></td>
                        <td className="px-4 py-3 font-black">Lv {row.level}</td>
                        <td className="px-4 py-3">{row.title}</td>
                        <td className="px-4 py-3">{number.format(row.total_xp)}</td>
                        <td className="px-4 py-3 text-ink/55">{formatAgo(row.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <Panel title="Recent evidence-based ledger" empty={xpEvents.length === 0 ? "No XP ledger events yet." : undefined}>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-cream text-xs uppercase tracking-wider text-ink/50"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">XP</th><th className="px-4 py-3">When</th></tr></thead><tbody className="divide-y divide-ink/10">
              {xpEvents.slice(0, 12).map((event) => <tr key={event.id}><td className="px-4 py-3"><p className="font-bold">{humanize(event.action)}</p><p className="max-w-[320px] truncate text-xs text-ink/45">{event.reason}</p></td><td className="px-4 py-3"><StatusBadge status={event.verification_level} /></td><td className="px-4 py-3 text-xs text-ink/55">{event.source_type}<br />{event.source_id?.slice(0, 18) ?? "legacy"}</td><td className="px-4 py-3 font-black">{Number(event.awarded_xp ?? event.xp_delta)}</td><td className="px-4 py-3 text-ink/55">{formatAgo(event.created_at)}</td></tr>)}
            </tbody></table></div>
          </Panel>
          <Panel title="Progress review flags" empty={progressionFlags.length === 0 ? "No suspicious progression patterns." : undefined}>
            <div className="grid gap-3 p-5">{progressionFlags.slice(0, 10).map((flag) => <div key={flag.id} className="rounded-2xl bg-cream p-4"><p className="font-bold text-ink">{humanize(flag.reason)}</p><p className="mt-1 text-xs text-ink/50">{maskEmail(profileById.get(flag.user_id)?.email ?? flag.user_id)} · {flag.severity} · {formatAgo(flag.created_at)}</p></div>)}</div>
          </Panel>
        </div>
      </Section>

      <Section title="Value Proof outcomes" kicker="Structure vs real-world proof" icon={<ShieldCheck className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<BarChart3 className="size-5" />} label="Avg clarity score" value={averageClarityScore} detail={`Sample: ${valueOutcomeRows.length} project${valueOutcomeRows.length === 1 ? "" : "s"}`} tone="violet" />
          <StatCard icon={<Target className="size-5" />} label="Avg evidence score" value={averageEvidenceScore} detail={`Sample: ${valueOutcomeRows.length} project${valueOutcomeRows.length === 1 ? "" : "s"}`} tone="gold" />
          <StatCard icon={<Users className="size-5" />} label="Contacted users" value={percent(valueOutcomeRows.filter((row) => row.proof.people_contacted > 0).length, valueOutcomeRows.length)} detail={`${valueOutcomeRows.filter((row) => row.proof.people_contacted > 0).length}/${valueOutcomeRows.length} projects`} tone="lime" />
          <StatCard icon={<MessageSquareText className="size-5" />} label="Value summary copied" value={copiedValueProofUsers.length} detail="Users who copied/share-exported Value Proof" tone="cream" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MiniMetric label="Validation experiment" value={valueOutcomeRows.filter((row) => row.proof.experiment_count > 0).length} />
          <MiniMetric label="Pain confirmed" value={valueOutcomeRows.filter((row) => row.proof.pain_confirmed > 0).length} />
          <MiniMetric label="Interest signal" value={valueOutcomeRows.filter((row) => row.proof.interested_users + row.proof.waitlist_signups > 0).length} />
          <MiniMetric label="Payment intent" value={valueOutcomeRows.filter((row) => row.proof.payment_intent > 0 || row.proof.preorders_or_revenue_cents > 0).length} />
        </div>
        <p className="mt-4 rounded-2xl bg-cream/70 p-4 text-sm leading-6 text-ink/60">
          Internal beta behavior only. These numbers describe PrismForge usage and logged evidence; they do not imply causation or guaranteed startup success.
        </p>
      </Section>

      <Section title="Beta cohort visibility" kicker="Who is active and where they are stuck" icon={<ShieldCheck className="size-5" />}>
        <Panel empty={betaUsers.length === 0 ? "No beta users loaded yet." : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Projects</th><th className="px-4 py-3">AI uses</th><th className="px-4 py-3">Proof</th><th className="px-4 py-3">Feedback</th><th className="px-4 py-3">Last active</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {betaUsers.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3"><p className="font-bold">{row.name || "Unnamed tester"}</p><p className="text-xs text-ink/45">{maskEmail(row.email)}</p></td>
                    <td className="px-4 py-3"><StatusBadge status={row.planLabel} /></td>
                    <td className="px-4 py-3">{row.projects}</td>
                    <td className="px-4 py-3">{row.aiUses}</td>
                    <td className="px-4 py-3">{row.proofExperiments}</td>
                    <td className="px-4 py-3">{row.feedback ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-ink/55">{formatAgo(row.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="AI cost controls" kicker="OpenAI, cache, fallback, blocked" icon={<Gauge className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-4">
          {aiSources.map((source) => <MiniMetric key={source} label={source} value={aiBySource[source]} />)}
        </div>
        <Panel title="Recent AI usage events" empty={featureUsageEvents.length === 0 ? "No feature usage events yet." : undefined} className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="px-4 py-3">Feature</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Max tokens</th><th className="px-4 py-3">Prompt size</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">When</th></tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {featureUsageEvents.slice(0, 25).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-bold">{humanize(event.feature)}</td>
                    <td className="px-4 py-3"><StatusBadge status={event.source} /></td>
                    <td className="px-4 py-3 text-xs text-ink/55">{event.model ?? "—"}</td>
                    <td className="px-4 py-3">{event.max_output_tokens ?? "—"}</td>
                    <td className="px-4 py-3">{event.approx_prompt_size ?? "—"}</td>
                    <td className="px-4 py-3">{event.duration_ms ? `${event.duration_ms}ms` : "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-ink/55">{event.error_category ?? event.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-ink/55">{formatAgo(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Reliability checks" kicker="Queues, rate limits, query warnings" icon={<MailWarning className="size-5" />}>
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Recent queued emails" empty={emailQueue.length === 0 ? "No queued emails yet." : undefined}>
            <div className="grid gap-3 p-5">{emailQueue.map((row) => <CompactRow key={row.id} title={row.email_type} detail={`${maskEmail(row.recipient)} · ${row.attempts} attempt(s)`} status={row.status} meta={row.last_error ?? row.subject} />)}</div>
          </Panel>
          <Panel title="Recent delivery logs" empty={emailLogs.length === 0 ? "No delivery logs yet." : undefined}>
            <div className="grid gap-3 p-5">{emailLogs.map((log) => <CompactRow key={log.id} title={log.email_type} detail={maskEmail(log.recipient)} status={log.status} meta={log.error_message ?? formatAgo(log.created_at)} />)}</div>
          </Panel>
          <Panel title="Rate-limit buckets" empty={rateLimitBuckets.length === 0 ? "No rate-limit buckets yet." : undefined}>
            <div className="grid gap-3 p-5">{rateLimitBuckets.map((bucket) => <CompactRow key={bucket.key} title={bucket.key} detail={`${bucket.count} hit(s)`} status="tracked" meta={`Updated ${formatAgo(bucket.updated_at)}`} />)}</div>
          </Panel>
        </div>
        <Panel title="Monitoring query warnings" empty={issues.length === 0 ? "All monitoring queries completed successfully." : undefined} className="mt-6">
          <div className="grid gap-3 p-5">{issues.map((issue) => <div key={issue} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{issue}</div>)}</div>
        </Panel>
      </Section>
    </div>
  );
}

async function safeCount(label: string, query: CountQuery, issues: string[]) {
  const { count, error } = await query;
  if (error) {
    issues.push(`${label}: ${error.message ?? "unknown error"}`);
    return 0;
  }
  return count ?? 0;
}

async function safeRows<T>(label: string, query: RowsQuery<T>, issues: string[]) {
  const { data, error } = await query;
  if (error) {
    issues.push(`${label}: ${error.message ?? "unknown error"}`);
    return [];
  }
  return data ?? [];
}

function StatCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone: "sky" | "lime" | "violet" | "amber" | "green" | "cream" | "gold" }) {
  return (
    <div className={`rounded-[1.5rem] border p-6 ${toneClass(tone)}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-black uppercase tracking-[.14em] text-ink/55">{label}</p>
        <div className="grid size-11 place-items-center rounded-2xl bg-white/80 text-ink shadow-sm">{icon}</div>
      </div>
      <p className="mt-5 font-display text-4xl font-semibold tracking-tight">{typeof value === "number" ? number.format(value) : value}</p>
      <p className="mt-2 text-sm leading-6 text-ink/60">{detail}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-ink/10 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p><p className="mt-2 font-display text-3xl font-semibold">{number.format(value)}</p></div>;
}

function Section({ title, kicker, icon, children }: { title: string; kicker: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-ink text-white">{icon}</div>
        <div><p className="text-sm font-black uppercase tracking-[.16em] text-moss">{kicker}</p><h2 className="mt-1 font-display text-3xl font-semibold">{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

function Panel({ title, empty, className = "", children }: { title?: string; empty?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-sm ${className}`}>
      {title && <div className="border-b border-ink/10 px-5 py-4"><h3 className="font-display text-xl font-semibold">{title}</h3></div>}
      {empty ? <div className="p-8 text-center text-sm text-ink/50">{empty}</div> : <div>{children}</div>}
    </div>
  );
}

function ProgressRow({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-sm">
        <span className="font-bold">{label}</span>
        <span className="shrink-0 text-ink/50">{number.format(value)}{detail ? ` · ${detail}` : ""}</span>
      </div>
      <ProgressBar value={(value / Math.max(1, max)) * 100} />
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-gradient-to-r from-violet via-moss to-gold" style={{ width: `${Math.max(3, Math.min(100, Math.round(value)))}%` }} /></div>;
}

function CompactRow({ title, detail, status, meta }: { title: string; detail: string; status: string; meta?: string | null }) {
  return (
    <div className="rounded-2xl border border-ink/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{title}</p>
          <p className="mt-1 truncate text-xs text-ink/45">{detail}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      {meta && <p className="mt-2 line-clamp-2 text-xs text-ink/55">{meta}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(status)}`}>{status}</span>;
}

function toneClass(tone: "sky" | "lime" | "violet" | "amber" | "green" | "cream" | "gold") {
  const map = {
    sky: "border-blue-100 bg-sky/35",
    lime: "border-moss/15 bg-lime/30",
    violet: "border-violet/15 bg-violet/10",
    amber: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50",
    cream: "border-ink/10 bg-white",
    gold: "border-gold/30 bg-gold/15",
  };
  return map[tone];
}

function statusClass(status: string) {
  if (["active", "sent", "openai", "cache", "completed", "premium", "lifetime founder", "tracked"].includes(status)) return "bg-green-50 text-green-800";
  if (["queued", "sending", "fallback", "planned", "free"].includes(status)) return "bg-blue-50 text-blue-800";
  if (["blocked", "paused", "failed"].includes(status)) return "bg-amber-50 text-amber-800";
  if (["error", "deleted"].includes(status)) return "bg-red-50 text-red-800";
  return "bg-ink/5 text-ink/60";
}

function formatAgo(value?: string | null) {
  if (!value) return "Never";
  try {
    return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function average(total: number, denominator: number) {
  return (total / Math.max(1, denominator)).toFixed(1);
}

function averageNumber(values: number[]) {
  if (!values.length) return "0";
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreTo100(items: Array<{ score: number; max: number }>) {
  const score = items.reduce((sum, item) => sum + item.score, 0);
  const max = items.reduce((sum, item) => sum + item.max, 0);
  return Math.round((score / Math.max(1, max)) * 100);
}

function isOpportunityReport(value: unknown): value is OpportunityReport {
  return Boolean(value && typeof value === "object" && "summary" in value && "mvpPlan" in value && "executionRoadmap" in value);
}

function summarizeXpActions(events: Pick<XpEvent, "action" | "xp_delta">[]) {
  const map = new Map<string, { action: string; count: number; xp: number }>();
  for (const event of events) {
    const current = map.get(event.action) ?? { action: event.action, count: 0, xp: 0 };
    current.count += 1;
    current.xp += Number(event.xp_delta ?? 0);
    map.set(event.action, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function eventCount(events: AppEvent[], eventName: string) {
  return events.filter((event) => event.event_name === eventName).length;
}

function uniqueEventUsers(events: AppEvent[], eventName: string, fallback = 0) {
  const count = unique(events.filter((event) => event.event_name === eventName).map((event) => event.user_id).filter(Boolean) as string[]).length;
  return Math.max(count, fallback);
}

function summarizeGenerationAttempts(events: AppEvent[], profileById: Map<string, Pick<Profile, "id" | "email" | "name">>) {
  const map = new Map<string, {
    requestId: string;
    userId: string | null;
    userName: string;
    userEmail: string;
    status: "started" | "completed" | "failed" | "diagnostic";
    stage: string;
    source: string | null;
    durationMs: number | null;
    errorCategory: string | null;
    projectId: string | null;
    firstAt: string;
    lastAt: string;
  }>();

  for (const event of events.filter((item) => item.event_name.startsWith("generate_project_") || item.event_name === "generation_diagnostic")) {
    const metadata = asMetadata(event.metadata);
    const requestId = typeof metadata.request_id === "string" ? metadata.request_id : event.id;
    const profile = event.user_id ? profileById.get(event.user_id) : null;
    const current = map.get(requestId);
    const eventStatus = event.event_name === "generate_project_completed" ? "completed" : event.event_name === "generate_project_failed" ? "failed" : event.event_name === "generate_project_started" ? "started" : "diagnostic";
    const status: "started" | "completed" | "failed" | "diagnostic" = current?.status === "completed" || current?.status === "failed" ? current.status : eventStatus;
    const next = {
      requestId,
      userId: event.user_id,
      userName: profile?.name ?? "Unknown tester",
      userEmail: profile?.email ? maskEmail(profile.email) : "hidden",
      status,
      stage: typeof metadata.stage === "string" ? metadata.stage : event.event_name,
      source: stringValue(metadata.generation_source) ?? stringValue(metadata.generation_mode),
      durationMs: numberValue(metadata.duration_ms) ?? current?.durationMs ?? null,
      errorCategory: stringValue(metadata.error_category) ?? stringValue(metadata.reason) ?? current?.errorCategory ?? null,
      projectId: stringValue(metadata.project_id) ?? current?.projectId ?? null,
      firstAt: current?.firstAt ?? event.created_at,
      lastAt: event.created_at > (current?.lastAt ?? "") ? event.created_at : current?.lastAt ?? event.created_at,
    };
    if (eventStatus === "completed" || eventStatus === "failed") next.status = eventStatus;
    map.set(requestId, next);
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()).slice(0, 30);
}

function asMetadata(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json | undefined> : {};
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function humanize(value: string) {
  return value.replace(/[_:.]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "hidden";
  return `${name.slice(0, 2)}***@${domain}`;
}

function countReturnedUsers(profiles: Array<Pick<Profile, "id" | "created_at">>, events: AppEvent[], days: number) {
  return profiles.filter((profile) => {
    const threshold = new Date(profile.created_at).getTime() + days * 24 * 60 * 60 * 1000;
    return events.some((event) => event.user_id === profile.id && new Date(event.created_at).getTime() >= threshold);
  }).length;
}

function userBetaRow(
  profile: Pick<Profile, "id" | "email" | "name" | "plan" | "beta_access_until" | "lifetime_founder" | "beta_feedback_completed" | "created_at" | "updated_at">,
  projects: Array<Pick<OpportunityProject, "user_id" | "updated_at">>,
  proofRows: ProjectValidationExperiment[],
  featureUsageEvents: FeatureUsageEvent[],
  appEvents: AppEvent[],
) {
  const userProjects = projects.filter((project) => project.user_id === profile.id);
  const userProof = proofRows.filter((row) => row.user_id === profile.id);
  const userFeatures = featureUsageEvents.filter((event) => event.user_id === profile.id);
  const userEvents = appEvents.filter((event) => event.user_id === profile.id);
  const lastActive = latestDate([profile.updated_at, ...userProjects.map((project) => project.updated_at), ...userProof.map((row) => row.updated_at), ...userFeatures.map((event) => event.created_at), ...userEvents.map((event) => event.created_at)]);
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    planLabel: getPlanLabel(profile),
    projects: userProjects.length,
    aiUses: userFeatures.length,
    proofExperiments: userProof.length,
    feedback: profile.beta_feedback_completed || userEvents.some((event) => event.event_name === "beta_feedback_submitted"),
    lastActive,
    lastActiveTime: new Date(lastActive).getTime(),
  };
}

function getPlanLabel(profile: Pick<Profile, "email" | "plan" | "beta_access_until" | "lifetime_founder" | "beta_feedback_completed">) {
  if (profile.lifetime_founder || profile.beta_feedback_completed) return "lifetime founder";
  if (isTemporaryBetaFounder(profile)) return "founder beta";
  if (process.env.PRIVATE_BETA_FOUNDER_ACCESS === "1" && getEffectivePlan(profile) === "founder") return "founder beta";
  return getEffectivePlan(profile);
}

function latestDate(values: string[]) {
  const newest = values.reduce((current, value) => Math.max(current, new Date(value).getTime()), 0);
  return new Date(newest || Date.now()).toISOString();
}
