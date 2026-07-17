"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Copy, Lightbulb, NotebookPen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SprintTaskOutput } from "@/lib/founder-os/executionTools";
import { calculateProjectHealth, createProjectBrief, getNextBestActionDetail } from "@/lib/founder-os/projectAlpha";
import type { BusinessType, OpportunityReport, ProjectStatus } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";

const ALPHA_TESTER_MODE_KEY = "prismforge_alpha_tester_mode";

export function ProjectAlphaPanel({
  projectId,
  title,
  status,
  score,
  businessType,
  targetCustomer,
  report,
  sprintTasks,
  proofSummary,
  showNextAction = true,
}: {
  projectId: string;
  title: string;
  status: ProjectStatus;
  score?: number | null;
  businessType: BusinessType;
  targetCustomer: string;
  report: OpportunityReport;
  sprintTasks?: SprintTaskOutput[];
  proofSummary?: ProofSummary;
  showNextAction?: boolean;
}) {
  const notesKey = `prismforge_notes_${projectId}`;
  const [alphaTesterMode, setAlphaTesterMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [fallbackText, setFallbackText] = useState("");
  const [liveProofSummary, setLiveProofSummary] = useState<ProofSummary | undefined>(proofSummary);
  const resetTimerRef = useRef<number | null>(null);

  const projectInput = useMemo(() => ({ title, status, score, businessType, targetCustomer, report, sprintTasks }), [businessType, report, score, sprintTasks, status, targetCustomer, title]);
  const health = useMemo(() => calculateProjectHealth(projectInput), [projectInput]);
  const nextAction = useMemo(() => getNextBestActionDetail({ status, sprintTasks, proof: liveProofSummary, report }), [liveProofSummary, report, sprintTasks, status]);
  const projectBrief = useMemo(() => createProjectBrief(projectInput), [projectInput]);

  useEffect(() => {
    setAlphaTesterMode(window.localStorage.getItem(ALPHA_TESTER_MODE_KEY) === "true");
    setNotes(window.localStorage.getItem(notesKey) ?? "");
    setSavedAt(window.localStorage.getItem(`${notesKey}_saved_at`));
  }, [notesKey]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function onProofSummaryUpdated(event: Event) {
      const custom = event as CustomEvent<{ projectId?: string; summary?: ProofSummary }>;
      if (custom.detail?.projectId === projectId && custom.detail.summary) setLiveProofSummary(custom.detail.summary);
    }
    window.addEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);
    return () => window.removeEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);
  }, [projectId]);

  function updateAlphaTesterMode(enabled: boolean) {
    setAlphaTesterMode(enabled);
    window.localStorage.setItem(ALPHA_TESTER_MODE_KEY, String(enabled));
  }

  function saveNotes() {
    const timestamp = new Date().toLocaleString();
    window.localStorage.setItem(notesKey, notes);
    window.localStorage.setItem(`${notesKey}_saved_at`, timestamp);
    setSavedAt(timestamp);
  }

  async function copyValue(value: string) {
    const didCopy = await copyTextToClipboard(value);
    setCopyState(didCopy ? "copied" : "failed");
    setFallbackText(didCopy ? "" : value);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_.95fr]">
      <div className="grid gap-5 md:grid-cols-2">
        <AlphaHealthCard score={health.score} label={health.label} missingItems={health.missingItems} />

        {showNextAction ? (
        <div id="next-best-action" className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet/10 text-violet">
              <Lightbulb className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Next Best Action</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">The one action most likely to move this project forward.</h2>
              <p className="mt-3 break-words text-sm font-bold leading-6 text-ink/75">{nextAction.action}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl bg-cream/65 p-4 text-sm leading-6 text-ink/65">
            <p><span className="font-black text-ink">Why it matters:</span> {nextAction.why}</p>
            <p><span className="font-black text-ink">Estimated time:</span> {nextAction.estimatedTime}</p>
            <p><span className="font-black text-ink">Go to:</span> {nextAction.area}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={nextAction.href}
              onClick={() => logClientEvent("next_best_action_selected", projectId, { area: nextAction.area })}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet hover:shadow-md"
            >
              Jump to action
            </a>
            <Button type="button" variant="secondary" onClick={() => copyValue(nextAction.action)} className="gap-2">
              <Copy className="size-4" />
              Copy Next Action
            </Button>
            <Button type="button" onClick={() => copyValue(projectBrief)} className="gap-2">
              <ClipboardList className="size-4" />
              Copy Project Brief
            </Button>
          </div>
          {copyState === "copied" && <p className="mt-3 text-sm font-semibold text-moss">Copied.</p>}
          {copyState === "failed" && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Clipboard failed. Copy manually:</p>
              <textarea readOnly value={fallbackText} className="mt-3 min-h-36 w-full rounded-2xl border border-amber-200 bg-white p-3 text-xs leading-6 text-ink/70" />
            </div>
          )}
        </div>
        ) : (
        <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-ink">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.16em] text-gold">Project Brief</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Copy the clean project summary.</h2>
              <p className="mt-3 break-words text-sm leading-6 text-ink/60">Use this when asking for feedback, sharing context, or handing the project to another tool.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={() => copyValue(projectBrief)} className="gap-2">
              <ClipboardList className="size-4" />
              Copy Project Brief
            </Button>
          </div>
          {copyState === "copied" && <p className="mt-3 text-sm font-semibold text-moss">Copied.</p>}
          {copyState === "failed" && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Clipboard failed. Copy manually:</p>
              <textarea readOnly value={fallbackText} className="mt-3 min-h-36 w-full rounded-2xl border border-amber-200 bg-white p-3 text-xs leading-6 text-ink/70" />
            </div>
          )}
        </div>
        )}

        <div className="rounded-[1.75rem] border border-ink/10 bg-gradient-to-br from-white to-lime/20 p-5 shadow-card md:col-span-2">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Alpha Tester Mode</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">Show helper hints while testing.</h3>
            </div>
            <button
              type="button"
              onClick={() => updateAlphaTesterMode(!alphaTesterMode)}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black transition ${alphaTesterMode ? "bg-moss text-white" : "bg-white text-ink ring-1 ring-ink/10"}`}
              aria-pressed={alphaTesterMode}
            >
              {alphaTesterMode ? "Enabled" : "Enable"}
            </button>
          </div>
          {alphaTesterMode && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Try consulting the AI team.", "Copy this output and use it to build.", "Submit beta feedback if anything breaks."].map((hint) => (
                <div key={hint} className="rounded-2xl bg-white/80 p-4 text-sm font-semibold leading-6 text-ink/65">
                  <Sparkles className="mb-2 size-4 text-violet" />
                  {hint}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-ink">
            <NotebookPen className="size-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-gold">Founder Notes</p>
            <h3 className="mt-2 font-display text-2xl font-semibold">Private browser notes</h3>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-5 min-h-56 w-full rounded-2xl border border-ink/10 bg-cream/60 p-4 text-sm leading-6 outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
          placeholder="Write tester notes, founder thoughts, customer quotes, or launch ideas here."
        />
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold text-ink/45">{savedAt ? `Saved ${savedAt}` : "Saved only in this browser."}</p>
          <Button type="button" onClick={saveNotes} className="gap-2">
            <Check className="size-4" />
            Save note
          </Button>
        </div>
      </div>
    </section>
  );
}

function AlphaHealthCard({ score, label, missingItems }: { score: number; label: string; missingItems: string[] }) {
  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-card">
      <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Alpha Health</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-5xl font-semibold">{score}</p>
          <p className="mt-1 text-sm font-black uppercase tracking-[.12em] text-ink/45">/100</p>
        </div>
        <span className="rounded-full bg-lime/30 px-4 py-2 text-xs font-black text-moss">{label}</span>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full bg-gradient-to-r from-violet via-moss to-gold transition-all duration-700" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-5 text-sm font-bold text-ink/70">Improve next:</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink/60">
        {missingItems.slice(0, 3).map((item) => <li key={item} className="break-words">• {item}</li>)}
      </ul>
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try textarea fallback below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);
    return didCopy;
  } catch {
    return false;
  }
}

function logClientEvent(eventName: "next_best_action_selected" | "validation_path_selected", projectId: string, metadata: Record<string, string>) {
  try {
    void fetch("/api/beta-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, metadata: { ...metadata, project_id: projectId } }),
      keepalive: true,
    });
  } catch {
    // Analytics is best-effort only.
  }
}
