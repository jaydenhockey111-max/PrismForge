"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Pencil, Sparkles } from "lucide-react";
import { updateBiggestQuestion } from "@/app/(app)/projects/validation-actions";

type FeedbackChoice = "yes" | "somewhat" | "no";

export function BiggestQuestionCard({
  projectId,
  assumptionId,
  statement,
  status,
  evidenceSummary,
  nextActionHref,
}: {
  projectId: string;
  assumptionId?: string | null;
  statement: string;
  status: "untested" | "supported" | "contradicted" | "inconclusive";
  evidenceSummary?: string | null;
  nextActionHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet/20 bg-gradient-to-br from-white via-violet/5 to-gold/15 p-5 shadow-card sm:p-6" aria-labelledby="biggest-question-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Biggest Question to Test</p>
            <span className={statusBadge(status)}>{status === "untested" ? "Unproven" : humanize(status)}</span>
          </div>
          {editing ? (
            <div className="mt-3">
              <label htmlFor="biggest-question" className="sr-only">Edit the biggest question to test</label>
              <textarea id="biggest-question" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} className="min-h-28 w-full rounded-2xl border border-violet/25 bg-white p-4 text-base font-semibold leading-7 text-ink outline-none ring-violet/20 focus:ring-4" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={pending || !assumptionId} onClick={() => startTransition(async () => {
                  if (!assumptionId) return;
                  const result = await updateBiggestQuestion(projectId, assumptionId, draft, crypto.randomUUID());
                  setMessage(result.ok ? "Question saved. New evidence will be tested against this wording." : result.error);
                  if (result.ok) setEditing(false);
                })} className="rounded-full bg-violet px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50">{pending ? "Saving…" : "Save question"}</button>
                <button type="button" onClick={() => { setDraft(statement); setEditing(false); setMessage(""); }} className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-black text-ink">Cancel</button>
              </div>
            </div>
          ) : (
            <h2 id="biggest-question-title" className="mt-3 max-w-4xl break-words font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">{statement}</h2>
          )}
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">This is an assumption, not a fact. Record real evidence before treating it as supported.</p>
          {evidenceSummary && <div className="mt-4 rounded-2xl border border-moss/15 bg-white/85 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-moss"><CheckCircle2 className="size-4" />What the latest evidence changed</p><p className="mt-2 text-sm font-semibold leading-6 text-ink/70">{evidenceSummary}</p></div>}
          {message && <p role="status" aria-live="polite" className="mt-3 text-sm font-bold text-moss">{message}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" disabled={!assumptionId} onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:border-violet/40 disabled:opacity-50"><Pencil className="size-4" />Edit</button>
          <Link href={nextActionHref} onClick={() => void track("core_loop_next_action_started", projectId, { source: "biggest_question" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet">Start test <ArrowRight className="size-4" /></Link>
        </div>
      </div>
    </section>
  );
}

export function TrackedCoreActionLink({ projectId, href, children }: { projectId: string; href: string; children: React.ReactNode }) {
  return <Link href={href} onClick={() => void track("core_loop_next_action_started", projectId, { source: "next_best_action" })} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-moss hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2">{children}</Link>;
}

export function CoreValueFeedback({ projectId }: { projectId: string }) {
  const [choice, setChoice] = useState<FeedbackChoice | null>(null);
  const [recommendationMoreUseful, setRecommendationMoreUseful] = useState<boolean | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [sent, setSent] = useState(false);
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const [permissionSaved, setPermissionSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (sent && showCaseStudy && !permissionSaved) return (
    <section className="mt-6 rounded-[2rem] border border-violet/15 bg-white p-5 shadow-card sm:p-6">
      <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Optional research permission</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Would you be open to sharing your experience with the PrismForge team?</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">This records permission to contact you using your account email. It does not copy or publish private project content.</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={async () => { const result = await track("case_study_permission_recorded", projectId, { permission: true, contact_preference: "account_email", milestone: "core_loop_helpful", request_id: crypto.randomUUID() }); if (result.ok) setPermissionSaved(true); else setError(`Permission could not be saved. Reference: ${result.requestId ?? "unavailable"}`); }} className="rounded-full bg-violet px-5 py-2.5 text-sm font-black text-white">Yes, you may contact me</button><button type="button" onClick={() => setPermissionSaved(true)} className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-black text-ink">Not now</button></div>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-coral">{error}</p>}
    </section>
  );
  if (sent) return null;
  return (
    <section className="mt-6 rounded-[2rem] border border-moss/15 bg-white p-5 shadow-card sm:p-6">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-moss"><Sparkles className="size-4" />One quick beta question</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Did PrismForge help you decide what to do next?</h2>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Feedback rating">
        {(["yes", "somewhat", "no"] as const).map((value) => <button key={value} type="button" aria-pressed={choice === value} onClick={() => setChoice(value)} className={`rounded-full border px-4 py-2 text-sm font-black transition ${choice === value ? "border-violet bg-violet text-white" : "border-ink/15 bg-cream/50 text-ink hover:border-violet/40"}`}>{value === "yes" ? "Yes, clearly" : humanize(value)}</button>)}
      </div>
      {choice && <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-black text-ink">Was the updated recommendation more useful than the original? <span className="font-normal text-ink/45">Optional</span></p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Updated recommendation usefulness">
            <button type="button" aria-pressed={recommendationMoreUseful === true} onClick={() => setRecommendationMoreUseful(true)} className={`rounded-full border px-4 py-2 text-sm font-black ${recommendationMoreUseful === true ? "border-violet bg-violet text-white" : "border-ink/15 text-ink"}`}>Yes</button>
            <button type="button" aria-pressed={recommendationMoreUseful === false} onClick={() => setRecommendationMoreUseful(false)} className={`rounded-full border px-4 py-2 text-sm font-black ${recommendationMoreUseful === false ? "border-violet bg-violet text-white" : "border-ink/15 text-ink"}`}>No</button>
          </div>
        </div>
        <div><label htmlFor="core-feedback" className="text-sm font-black text-ink">What did it help you decide? <span className="font-normal text-ink/45">Optional</span></label><textarea id="core-feedback" value={followUp} onChange={(event) => setFollowUp(event.target.value)} maxLength={500} className="mt-2 min-h-24 w-full rounded-2xl border border-ink/15 p-3 text-sm text-ink outline-none focus:border-violet" /></div>
      </div>}
      <button type="button" disabled={!choice || pending} onClick={() => startTransition(async () => {
        setError("");
        const result = await track("core_loop_feedback_submitted", projectId, { rating: choice, recommendation_more_useful: recommendationMoreUseful, follow_up: followUp.trim(), request_id: crypto.randomUUID() });
        if (!result.ok) { setError(`Feedback could not be saved. Reference: ${result.requestId ?? "unavailable"}`); return; }
        setSent(true);
        setShowCaseStudy(choice === "yes" && result.caseStudyEligible === true);
      })} className="mt-4 rounded-full bg-moss px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{pending ? "Sending…" : "Send feedback"}</button>
      <button type="button" disabled={pending} onClick={() => startTransition(async () => {
        setError("");
        const result = await track("core_loop_feedback_dismissed", projectId, { request_id: crypto.randomUUID() });
        if (!result.ok) { setError(`Preference could not be saved. Reference: ${result.requestId ?? "unavailable"}`); return; }
        setSent(true);
      })} className="ml-2 mt-4 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-black text-ink disabled:opacity-50">Not now</button>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-coral">{error}</p>}
    </section>
  );
}

async function track(eventName: string, projectId: string, metadata: Record<string, string | boolean | null>) {
  try {
    const response = await fetch("/api/beta-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName, metadata: { ...metadata, project_id: projectId } }), keepalive: true });
    const body = await response.json().catch(() => ({})) as { ok?: boolean; requestId?: string; caseStudyEligible?: boolean };
    return { ok: response.ok && body.ok === true, requestId: body.requestId, caseStudyEligible: body.caseStudyEligible };
  } catch {
    return { ok: false, requestId: typeof metadata.request_id === "string" ? metadata.request_id : undefined, caseStudyEligible: false };
  }
}

function statusBadge(status: string) {
  if (status === "supported") return "rounded-full bg-lime px-3 py-1 text-xs font-black text-moss";
  if (status === "contradicted") return "rounded-full bg-coral/15 px-3 py-1 text-xs font-black text-coral";
  return "rounded-full bg-gold/30 px-3 py-1 text-xs font-black text-ink";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
