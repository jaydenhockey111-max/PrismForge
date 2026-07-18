"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Compass, RotateCcw, ShieldAlert, Target } from "lucide-react";
import { recordProjectDecision, saveFounderValidationPreference, switchValidationPath } from "@/app/(app)/projects/validation-actions";
import type { ProjectAssumption, ProjectDecision, ValidationPathRow } from "@/lib/database.types";
import { FOUNDER_VALIDATION_PREFERENCE_OPTIONS, type FounderValidationPreference, type ValidationRoutingResult } from "@/lib/founder-os/validationReadiness";

type Props = {
  projectId: string;
  route: ValidationRoutingResult;
  activePath: ValidationPathRow | null;
  preference: FounderValidationPreference | null;
  assumptions: ProjectAssumption[];
  decisions: ProjectDecision[];
  history: ValidationPathRow[];
  persistenceReady: boolean;
  compact?: boolean;
};

export function ValidationPathWorkspace(props: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("continue");
  const [rationale, setRationale] = useState("");
  const [previousAssumption, setPreviousAssumption] = useState("");
  const [newAssumption, setNewAssumption] = useState("");
  const [decisionEvidence, setDecisionEvidence] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("");
  const assumption = props.assumptions.find((item) => item.assumption_key === props.route.targetAssumptionKey) ?? props.assumptions[0] ?? null;

  if (props.compact) {
    return (
      <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet/15 bg-gradient-to-br from-white via-violet/5 to-lime/20 p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet"><Compass className="size-4" /> Active validation path</p>
            <h2 className="mt-2 break-words font-display text-2xl font-semibold text-ink">{props.route.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">{props.route.firstAction.action}</p>
            <p className="mt-2 text-xs font-bold text-moss">Done when: {props.route.firstAction.doneWhen}</p>
          </div>
          <Link href={`/projects/${props.projectId}?section=validate`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
            Open path <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet/15 bg-white shadow-card" id="validation-path">
      <div className="bg-gradient-to-br from-violet/10 via-white to-lime/20 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet"><Compass className="size-4" /> Your active path</p>
            <h2 className="mt-3 break-words font-display text-3xl font-semibold tracking-tight text-ink">{props.route.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">{props.route.rationale}</p>
          </div>
          <div className="w-full rounded-2xl border border-moss/15 bg-white/90 p-4 lg:w-64">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[.12em] text-moss"><span>Path progress</span><span>{props.route.progress}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-gradient-to-r from-violet to-moss transition-all" style={{ width: `${props.route.progress}%` }} /></div>
            <p className="mt-3 text-xs font-semibold leading-5 text-ink/55">Suggested stage: {humanize(props.route.suggestedStage)}</p>
          </div>
        </div>

        {props.route.avoidanceGuard && <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><p>{props.route.avoidanceGuard}</p></div>}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <PathFact icon={<Target className="size-4" />} label="Assumption being tested" value={props.route.targetAssumption} />
          <PathFact icon={<CheckCircle2 className="size-4" />} label="Path is complete when" value={props.route.completionRequirement} />
        </div>

        <div className="mt-4 rounded-2xl border border-violet/15 bg-ink p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[.14em] text-lime">Next concrete action · {props.route.firstAction.estimatedTime}</p>
          <p className="mt-3 text-lg font-black leading-7">{props.route.firstAction.action}</p>
          <p className="mt-2 text-sm leading-6 text-white/70">{props.route.firstAction.why}</p>
          <div className="mt-4 grid gap-3 text-xs leading-5 text-white/75 sm:grid-cols-2">
            <p><strong className="text-white">Record:</strong> {props.route.firstAction.evidenceToRecord}</p>
            <p><strong className="text-white">Then:</strong> {props.route.firstAction.afterCompletion}</p>
          </div>
          <Link href={props.route.firstAction.href} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-lime px-5 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-white">Record proof <ArrowRight className="size-4" /></Link>
        </div>
      </div>

      <div className="border-t border-ink/10 p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Founder preference</h3>
            <p className="mt-1 text-sm leading-6 text-ink/55">This changes the route only when it is still evidence-safe.</p>
            <select defaultValue={props.preference ?? ""} disabled={pending || !props.persistenceReady} onChange={(event) => startTransition(async () => { const result = await saveFounderValidationPreference(props.projectId, event.target.value); setMessage(result.ok ? "Preference saved. The path has been recalculated." : result.error); })} className="mt-3 min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold text-ink focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20">
              <option value="" disabled>Choose what feels workable</option>
              {FOUNDER_VALIDATION_PREFERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Evidence path history</h3>
            <div className="mt-3 space-y-2">
              {props.history.length === 0 ? <p className="rounded-xl bg-cream/60 p-3 text-sm text-ink/55">History begins when the migration is applied and this path is activated.</p> : props.history.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream/60 px-3 py-2 text-sm"><span className="min-w-0 truncate font-bold text-ink">{humanize(item.path_type)}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-black text-ink/55">{humanize(item.status)}</span></div>)}
            </div>
          </div>
        </div>

        {props.route.alternatives.length > 0 && <div className="mt-7">
          <h3 className="font-display text-xl font-semibold text-ink">Other safe routes</h3>
          <p className="mt-1 text-sm text-ink/55">At most two alternatives are shown so changing direction stays deliberate.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">{props.route.alternatives.map((alternative) => <div key={alternative.pathType} className="rounded-2xl border border-ink/10 p-4">
            <p className="font-black text-ink">{alternative.title}</p><p className="mt-2 text-sm leading-6 text-ink/60">{alternative.whyItMightFit}</p><p className="mt-2 text-xs leading-5 text-ink/50">Tradeoff: {alternative.tradeoff}</p>
            {switchingTo === alternative.pathType ? <div className="mt-3"><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Why does this route fit better right now?" className="min-h-24 w-full rounded-xl border border-ink/15 p-3 text-sm text-ink" /><div className="mt-2 flex flex-wrap gap-2"><button disabled={pending} onClick={() => startTransition(async () => { const result = await switchValidationPath(props.projectId, alternative.pathType, reason, crypto.randomUUID()); setMessage(result.ok ? "Path changed." : result.error); if (result.ok) { setSwitchingTo(null); setReason(""); } })} className="rounded-full bg-violet px-4 py-2 text-xs font-black text-white disabled:opacity-50">Confirm path</button><button onClick={() => setSwitchingTo(null)} className="rounded-full border border-ink/15 px-4 py-2 text-xs font-black text-ink">Cancel</button></div></div> : <button disabled={!props.persistenceReady} onClick={() => setSwitchingTo(alternative.pathType)} className="mt-3 inline-flex items-center gap-2 text-sm font-black text-violet disabled:text-ink/30"><RotateCcw className="size-4" /> Use this path</button>}
          </div>)}</div>
        </div>}

        <div className="mt-7 rounded-2xl border border-moss/15 bg-lime/10 p-4 sm:p-5">
          <h3 className="font-display text-xl font-semibold text-ink">Record the decision</h3>
          <p className="mt-1 text-sm leading-6 text-ink/55">A decision turns evidence into progress. It does not claim the assumption is proven.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
            <select value={decision} onChange={(event) => setDecision(event.target.value)} className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold text-ink"><option value="continue">Continue this path</option><option value="narrow_audience">Narrow the audience</option><option value="revise_problem">Revise the problem</option><option value="revise_solution">Revise the solution</option><option value="test_pricing">Test pricing</option><option value="build_prototype">Build a prototype</option><option value="pause">Pause project</option><option value="launch">Prepare to launch</option></select>
            <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={2000} placeholder="What did the evidence change?" className="min-h-24 rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink" />
          </div>
          <details className="mt-3 rounded-xl border border-ink/10 bg-white/70 p-3"><summary className="cursor-pointer text-sm font-black text-violet">Add before → after context</summary><p className="mt-2 text-xs leading-5 text-ink/50">Especially useful for audience, problem, pricing, and pivot decisions.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><textarea value={previousAssumption} onChange={(event)=>setPreviousAssumption(event.target.value)} maxLength={1000} placeholder="Before: what did you believe?" className="min-h-20 rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink"/><textarea value={newAssumption} onChange={(event)=>setNewAssumption(event.target.value)} maxLength={1000} placeholder="After: what do you believe now?" className="min-h-20 rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink"/><textarea value={decisionEvidence} onChange={(event)=>setDecisionEvidence(event.target.value)} maxLength={1500} placeholder="Evidence: interviews, results, or patterns" className="min-h-20 rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink"/><textarea value={decisionOutcome} onChange={(event)=>setDecisionOutcome(event.target.value)} maxLength={1500} placeholder="Outcome (optional; update in a later decision)" className="min-h-20 rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink"/></div></details>
          <button disabled={pending || !props.persistenceReady} onClick={() => startTransition(async () => { const result = await recordProjectDecision(props.projectId, decision, rationale, crypto.randomUUID(), props.activePath?.id, assumption?.id, { previousAssumption, newAssumption, evidenceSummary: decisionEvidence, outcome: decisionOutcome }); setMessage(result.ok ? "Decision saved to project history." : result.error); if (result.ok) { setRationale(""); setPreviousAssumption(""); setNewAssumption(""); setDecisionEvidence(""); setDecisionOutcome(""); } })} className="mt-3 rounded-full bg-moss px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50">Save decision</button>
          {props.decisions[0] && <p className="mt-3 text-xs leading-5 text-ink/55">Latest: <strong>{humanize(props.decisions[0].decision_type)}</strong> — {props.decisions[0].rationale}</p>}
        </div>

        {!props.persistenceReady && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">The route is available locally. Run migration 20260712000013 to enable preferences, switching, and history.</p>}
        {message && <p role="status" aria-live="polite" className="mt-4 text-sm font-bold text-moss">{message}</p>}
      </div>
    </section>
  );
}

function PathFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-ink/10 bg-white/85 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-ink/45">{icon}{label}</p><p className="mt-2 break-words text-sm font-semibold leading-6 text-ink/75">{value}</p></div>; }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
