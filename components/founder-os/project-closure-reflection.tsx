"use client";

import { useEffect, useRef, useState } from "react";
import { BookCheck } from "lucide-react";
import { saveProjectClosureReflection } from "@/app/(app)/projects/actions";
import type { ProjectClosureReflection } from "@/lib/database.types";

export function ProjectClosureReflectionCard({ projectId, initial }: { projectId: string; initial?: ProjectClosureReflection | null }) {
  const [outcome, setOutcome] = useState<ProjectClosureReflection["outcome"]>(initial?.outcome ?? "paused");
  const [learned, setLearned] = useState(initial?.what_was_learned ?? "");
  const [evidence, setEvidence] = useState(initial?.strongest_evidence ?? "");
  const [mistake, setMistake] = useState(initial?.biggest_mistake ?? "");
  const [reason, setReason] = useState(initial?.closure_reason ?? "");
  const [different, setDifferent] = useState(initial?.would_do_differently ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const valid = [learned, evidence, reason, different].every((value) => value.trim().length >= 12);

  async function save() {
    if (!valid || pending) return;
    setPending(true); setMessage("");
    try {
      const result = await saveProjectClosureReflection(projectId, { outcome, whatWasLearned: learned, strongestEvidence: evidence, biggestMistake: mistake, closureReason: reason, wouldDoDifferently: different });
      if (!mountedRef.current) return;
      setMessage(result.ok ? `Reflection saved.${result.awardedXp ? ` +${result.awardedXp} founder XP recorded once.` : ""}` : result.error);
    } catch {
      if (!mountedRef.current) return;
      setMessage("Reflection could not be saved. Your text is still here.");
    } finally { if (mountedRef.current) setPending(false); }
  }

  return (
    <details className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <summary className="cursor-pointer list-none">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-moss"><BookCheck className="size-4" />Project closure and lessons</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Pause or close this chapter thoughtfully.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">A status change alone earns nothing. A detailed reflection can receive reduced, one-time progress credit because it captures reusable learning.</p>
      </summary>
      <div className="mt-6 grid gap-4 border-t border-ink/10 pt-6">
        <label className="grid gap-2 text-sm font-bold text-ink">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as ProjectClosureReflection["outcome"])} className="min-h-11 rounded-2xl border border-ink/10 bg-cream/40 px-4 outline-none focus:border-violet"><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option><option value="abandoned">Abandoned</option></select></label>
        <div className="grid gap-4 md:grid-cols-2">
          <ReflectionField label="What did you learn?" value={learned} onChange={setLearned} />
          <ReflectionField label="What was the strongest evidence?" value={evidence} onChange={setEvidence} />
          <ReflectionField label="Why did this project end or pause?" value={reason} onChange={setReason} />
          <ReflectionField label="What would you do differently?" value={different} onChange={setDifferent} />
        </div>
        <ReflectionField label="Biggest mistake (optional)" value={mistake} onChange={setMistake} />
        <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!valid || pending} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white transition hover:bg-violet disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Saving..." : "Save reflection"}</button>{message && <p aria-live="polite" className="text-sm font-semibold text-ink/65">{message}</p>}</div>
      </div>
    </details>
  );
}

function ReflectionField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-bold text-ink">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} maxLength={1200} className="min-h-28 w-full resize-y rounded-2xl border border-ink/10 bg-cream/40 p-4 font-normal leading-6 outline-none focus:border-violet" placeholder="Write at least one clear sentence." /></label>;
}
