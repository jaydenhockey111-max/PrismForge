"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Copy, LoaderCircle, Search, Sparkles } from "lucide-react";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import type { MarketResearchExecution } from "@/lib/database.types";
import { marketResearchResultSchema } from "@/lib/execution/marketResearch";
import type { ExecutionSupport } from "@/lib/founder-os/executionSupport";

type MarketResearchOffer = { visible: boolean; canStart: boolean; unavailableReason: string | null; execution: MarketResearchExecution | null };

export function NextMoveExecutionAssistant({ projectId, support, marketResearch }: { projectId: string; support: ExecutionSupport; marketResearch?: MarketResearchOffer }) {
  const [prepared, setPrepared] = useState(false);

  useEffect(() => {
    function openLinkedSupport() {
      if (window.location.hash !== "#execution-support") return;
      setPrepared(true);
      track("help_me_do_it_opened", { project_id: projectId, support_type: support.type });
      track("support_type_selected", { project_id: projectId, support_type: support.type, execution_mode: support.executionMode });
    }
    openLinkedSupport();
    window.addEventListener("hashchange", openLinkedSupport);
    return () => window.removeEventListener("hashchange", openLinkedSupport);
  }, [projectId, support.executionMode, support.type]);

  function prepare() {
    setPrepared(true);
    track("help_me_do_it_opened", { project_id: projectId, support_type: support.type });
    track("support_type_selected", { project_id: projectId, support_type: support.type, execution_mode: support.executionMode });
  }

  function startEvidenceHandoff() {
    track("evidence_handoff_started", { project_id: projectId, support_type: support.type });
    document.getElementById("proof-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("prismforge:open-proof-starter")), 250);
  }

  return (
    <section id="execution-support" className="mt-6 overflow-hidden rounded-[2rem] border border-violet/20 bg-white shadow-card">
      <div className="bg-gradient-to-br from-violet/10 via-white to-lime/20 p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet"><Sparkles className="size-4" /> Help me do it</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">{support.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">{support.summary}</p>
        {!prepared ? (
          <button type="button" onClick={prepare} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
            <Sparkles className="size-4" /> {support.primaryLabel}
          </button>
        ) : null}
        {support.type === "research" && marketResearch?.visible ? <div className="mt-4 max-w-3xl"><MarketResearchControl projectId={projectId} offer={marketResearch} /></div> : null}
      </div>

      {prepared ? (
        <div className="p-5 sm:p-7">
          {support.changedVariable ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p className="font-black">What changes in this follow-up</p><p className="mt-1">{support.changedVariable}</p></div> : null}
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {support.steps.map((item, index) => <li key={item.title} className="rounded-2xl border border-ink/10 bg-cream/50 p-4"><p className="text-xs font-black uppercase tracking-[.13em] text-moss">{index + 1}. {item.title}</p><p className="mt-2 text-sm leading-6 text-ink/65">{item.detail}</p></li>)}
          </ol>

          <div className="mt-6 grid gap-4">
            {support.artifacts.map((item) => <article key={item.label} className="rounded-2xl border border-ink/10 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl font-semibold text-ink">{item.label}</p><CopySectionButton text={item.content} label="Copy" analyticsEventName="artifact_copied" projectId={projectId} /></div><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-ink/65">{item.content}</pre></article>)}
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-moss/20 bg-lime/15 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-moss"><CheckCircle2 className="size-4" /> Done when</p><p className="mt-2 text-sm font-semibold leading-6 text-ink/75">{support.doneWhen}</p><p className="mt-3 text-xs leading-5 text-ink/55"><span className="font-black text-ink">Record:</span> {support.evidenceToRecord}</p></div>
            <button type="button" onClick={startEvidenceHandoff} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"><ClipboardCheck className="size-4" /> Record the real outcome</button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink/50"><Copy className="size-3.5" /> Preparing or copying material does not complete this Next Move. Record the external outcome when it happens.</p>
        </div>
      ) : null}
    </section>
  );
}

function MarketResearchControl({ projectId, offer }: { projectId: string; offer: MarketResearchOffer }) {
  const [execution, setExecution] = useState(offer.execution);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const result = execution?.status === "completed" && execution.result_json ? marketResearchResultSchema.safeParse(execution.result_json) : null;

  async function startResearch() {
    if (!offer.canStart) { setMessage(offer.unavailableReason ?? "Autonomous research is unavailable."); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/executions/market-research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, requestId: crypto.randomUUID() }) });
      const payload = await response.json() as { executionId?: string; status?: string; error?: string };
      if (!response.ok || !payload.executionId) throw new Error(payload.error ?? "Research could not be started.");
      setExecution((current) => current ? { ...current, id: payload.executionId!, status: (payload.status ?? "queued") as MarketResearchExecution["status"] } : { id: payload.executionId!, status: (payload.status ?? "queued") as MarketResearchExecution["status"] } as MarketResearchExecution);
      setMessage("Research is queued. You can leave this page and return later.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Research could not be started."); }
    finally { setBusy(false); }
  }

  async function handoff() {
    if (!execution) return;
    setHandingOff(true); setMessage(null);
    try {
      const response = await fetch("/api/executions/market-research/handoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ executionId: execution.id }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The finding could not be added to the Proof Board.");
      setMessage("Added as AI-assisted secondary research. It does not count as customer validation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The finding could not be added to the Proof Board."); }
    finally { setHandingOff(false); }
  }

  return (
    <section className="rounded-2xl border border-violet/20 bg-violet/5 p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-violet"><Search className="size-4" /> Secondary research</p>
      {result?.success ? <div className="mt-3 space-y-4 text-sm leading-6 text-ink/70"><div><p className="font-black text-ink">What we found</p><p>{result.data.conciseAnswer}</p></div><div><p className="font-black text-ink">Why it matters</p><ul className="list-disc pl-5">{result.data.implicationsForNextMove.map((item) => <li key={item}>{item}</li>)}</ul></div><div><p className="font-black text-ink">Sources</p><ul className="mt-1 space-y-1">{result.data.sources.map((source) => <li key={source.url}><a className="underline decoration-violet/40 underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> <span className="text-xs text-ink/50">({source.sourceType})</span></li>)}</ul></div><button type="button" onClick={handoff} disabled={handingOff} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-4 text-sm font-black text-ink disabled:opacity-60">{handingOff ? "Adding…" : "Add useful finding to Proof Board"}</button></div> : <><p className="mt-2 text-sm leading-6 text-ink/65">Have PrismForge gather a small, cited view of alternatives and public behavior patterns. This is preparation, not customer validation.</p><button type="button" onClick={startResearch} disabled={busy || execution?.status === "queued" || execution?.status === "running"} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet px-5 text-sm font-black text-white disabled:opacity-60">{busy || execution?.status === "queued" || execution?.status === "running" ? <><LoaderCircle className="size-4 animate-spin" /> Research in progress</> : "Do It For Me"}</button></>}
      {message ? <p className="mt-3 text-xs font-semibold leading-5 text-ink/65" role="status">{message}</p> : null}
    </section>
  );
}

function track(eventName: "help_me_do_it_opened" | "support_type_selected" | "evidence_handoff_started", metadata: Record<string, string>) {
  void fetch("/api/beta-events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, metadata }), keepalive: true });
}
