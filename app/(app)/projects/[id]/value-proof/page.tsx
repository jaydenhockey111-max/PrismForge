import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, GitBranch, ShieldCheck } from "lucide-react";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import { ValueFundamentals, ValueItemList } from "@/components/founder-os/value-proof-card";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import type { AppEvent, ProjectOutput, ProjectValidationExperiment } from "@/lib/database.types";
import { getSafeDisplayProjectTitle } from "@/lib/founder-os/titleQuality";
import type { OpportunityReport } from "@/lib/founder-os/types";
import { buildValueProofReport } from "@/lib/founder-os/valueProof";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Value Proof" };

export default async function ProjectValueProofPage({ params }: { params: Promise<{ id: string }> }) {
  const [profile, routeParams, supabase] = await Promise.all([requireProfile(), params, createClient()]);
  const { data: project, error } = await supabase
    .from("opportunity_projects")
    .select("*")
    .eq("id", routeParams.id)
    .eq("user_id", profile.id)
    .single();

  if (error || !project) notFound();
  const report = project.report_json as unknown as OpportunityReport;
  if (!report?.summary || !report?.mvpPlan || !report?.executionRoadmap) notFound();

  const [{ data: outputs }, { data: experiments }, { data: events }] = await Promise.all([
    supabase.from("project_outputs").select("*").eq("project_id", project.id).eq("user_id", profile.id),
    supabase.from("project_validation_experiments").select("*").eq("project_id", project.id).eq("user_id", profile.id).order("created_at", { ascending: true }),
    supabase.from("app_events").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(500),
  ]);

  const proofExperiments = (experiments ?? []) as ProjectValidationExperiment[];
  const proofSummary = summarizeProof(proofExperiments);
  const displayTitle = getSafeDisplayProjectTitle(project);
  const displayProject = { ...project, title: displayTitle };
  const valueProof = buildValueProofReport({
    project: displayProject,
    report,
    proof: proofSummary,
    experiments: proofExperiments,
    outputs: (outputs ?? []) as ProjectOutput[],
    appEvents: (events ?? []) as AppEvent[],
  });

  await logBetaEvent({
    userId: profile.id,
    projectId: project.id,
    eventName: "value_proof_viewed",
    source: "value_proof_page",
    metadata: {
      fundamentals_defined: valueProof.clarityDefinedCount,
      fundamentals_total: valueProof.clarityTotalCount,
      evidence_items: valueProof.evidenceItemCount,
      history_status: valueProof.snapshot.historyStatus,
    },
    throttleSeconds: 15 * 60,
  });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "value_proof_report_opened", source: "value_proof_page", metadata: { fundamentals_defined: valueProof.clarityDefinedCount, evidence_items: valueProof.evidenceItemCount }, throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: valueProof.startingPoint ? "value_proof_starting_point_viewed" : "value_proof_data_missing", source: "value_proof_page", metadata: { has_starting_point: Boolean(valueProof.startingPoint) }, throttleSeconds: 15 * 60 });
  if (valueProof.evidenceItemCount === 0) await logBetaEvent({ userId: profile.id, projectId: project.id, eventName: "value_proof_empty_state_viewed", source: "value_proof_page", metadata: { section: "evidence" }, throttleSeconds: 15 * 60 });

  return (
    <div>
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-ink/55 hover:text-ink">
        <ArrowLeft className="size-4" />
        Back to project
      </Link>

      <section className="mt-6 rounded-[2rem] border border-ink/10 bg-ink p-7 text-white shadow-glow">
        <p className="text-sm font-black uppercase tracking-[.16em] text-gold">Value Proof</p>
        <h1 className="page-title mt-3 max-w-4xl">{displayTitle}</h1>
        <p className="mt-3 max-w-3xl leading-7 text-white/70">
          A factual record of what PrismForge organized, what you did, what evidence exists, and what remains unproven.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CopySectionButton text={valueProof.shareSummary} label="Copy progress summary" analyticsEventName="value_summary_copied" projectId={project.id} />
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<CheckCircle2 className="size-5" />} label="Fundamentals defined" value={`${valueProof.clarityDefinedCount}/${valueProof.clarityTotalCount}`} detail="Checklist based on stored project fields." />
        <Metric icon={<ShieldCheck className="size-5" />} label="Evidence items" value={valueProof.evidenceItemCount} detail="Proof Board evidence only. AI output does not count." />
        <Metric icon={<ClipboardList className="size-5" />} label="Assumptions tracked" value={valueProof.snapshot.assumptionsIdentified.length} detail="Beliefs separated from recorded evidence." />
        <Metric icon={<GitBranch className="size-5" />} label="Decisions" value={valueProof.decisionHistory.length} detail="Derived from stage, proof, and recorded learnings." />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card title="Before PrismForge" text={valueProof.startingPoint ?? "Original starting inputs were not recorded for this project."} />
        <Card title="After PrismForge" text={valueProof.structuredProject} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <ValueFundamentals items={valueProof.clarityFundamentals} />
        <ValueItemList title="Evidence collected" items={valueProof.snapshot.evidenceCollected} empty="No external evidence yet. Complete a validation step to begin building proof." />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <ValueItemList title="What PrismForge helped with" items={valueProof.snapshot.prismForgeContribution} empty="No supported PrismForge contribution recorded yet." />
        <ValueItemList title="What you did" items={valueProof.snapshot.founderContribution} empty="No real-world founder actions recorded yet." />
        <ValueItemList title="Still unknown" items={valueProof.snapshot.stillUnknown} empty="No unresolved assumptions recorded." />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.9fr]">
        <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-3xl font-semibold text-ink">Assumptions vs Evidence</h2>
          <div className="mt-5 grid gap-3">
            {valueProof.snapshot.assumptionsIdentified.map((row) => (
              <div key={row.assumption} className="rounded-2xl bg-cream/65 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <p className="font-bold text-ink">{row.assumption}</p>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-violet">{row.status}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/60">{row.evidence}</p>
                <p className="mt-2 text-xs font-semibold text-ink/40">Source: {row.source.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-3xl font-semibold text-ink">Next Best Action</h2>
          <div className="mt-5 grid gap-3 text-sm leading-6 text-ink/65">
            <Info label="Action" value={valueProof.nextBestAction.action} />
            <Info label="Why now" value={valueProof.nextBestAction.whyNow} />
            <Info label="What this will prove" value={valueProof.nextBestAction.whatThisWillProve} />
            <Info label="Success condition" value={valueProof.nextBestAction.successCondition} />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <ValueItemList title="Progress since start" items={valueProof.snapshot.milestonesReached} empty="No meaningful progress recorded yet." />
        <ValueItemList title="Decision history" items={valueProof.snapshot.decisionsRecorded} empty="No major project decisions have been recorded yet." />
      </section>

      <section className="mt-8 rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-semibold text-ink">Outcome Timeline</h2>
        <div className="mt-5 grid gap-3">
          {valueProof.outcomeTimeline.map((item) => (
            <div key={`${item.date}-${item.label}`} className="rounded-2xl border border-ink/10 bg-cream/50 p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{formatDate(item.date)}</p>
              <p className="mt-2 font-bold text-ink">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[1.5rem] border border-gold/30 bg-gold/10 p-5">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/55">Time-saved claims</p>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          PrismForge does not estimate time saved here because that would require a reliable baseline. This page only shows stored structure, recorded evidence, and traceable project history.
        </p>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
        <div className="grid size-10 place-items-center rounded-2xl bg-violet/10 text-violet">{icon}</div>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm leading-6 text-ink/55">{detail}</p>
    </div>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.14em] text-violet">{title}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">{text}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-cream/65 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p><p className="mt-2 font-semibold text-ink/70">{value}</p></div>;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "Recently";
  }
}
