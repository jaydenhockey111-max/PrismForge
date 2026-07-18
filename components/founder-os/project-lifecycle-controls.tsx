"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CirclePause, MoreHorizontal, RotateCcw, Square, Trash2, X } from "lucide-react";
import { resumeProject, transitionProjectLifecycle } from "@/app/(app)/projects/lifecycle-actions";
import type { ProjectLifecycleStatus } from "@/lib/database.types";
import { PROJECT_LIFECYCLE_LABELS, type ProjectLifecycleAction } from "@/lib/founder-os/projectLifecycle";

export function ProjectLifecycleControls({ projectId, title, lifecycleStatus, lifecycleVersion, deletedAt, recoveryExpiresAt, hasClosureReflection, compact = false }: { projectId: string; title: string; lifecycleStatus: ProjectLifecycleStatus; lifecycleVersion: number; deletedAt: string | null; recoveryExpiresAt: string | null; hasClosureReflection: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<ProjectLifecycleAction | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!action) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAction(null);
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')];
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [action]);

  function submit() {
    if (!action || pending) return;
    setMessage("");
    startTransition(async () => {
      const requestId = crypto.randomUUID();
      const result = action === "resume"
        ? await resumeProject(projectId, requestId, lifecycleVersion, compact ? "project_library_card" : "project_workspace")
        : await transitionProjectLifecycle({ projectId, action, reason, requestId, expectedVersion: lifecycleVersion, setFocus: action === "restore", confirmation, source: compact ? "project_library_card" : "project_workspace" });
      if (!result.ok) { setMessage(result.error ?? "The project could not be updated."); return; }
      if (action === "permanent_delete") clearLocalProjectData(projectId);
      setAction(null); setReason(""); setConfirmation("");
      setMessage(action === "permanent_delete" ? "Project permanently deleted." : "Project lifecycle updated.");
      if (result.href && (action === "permanent_delete" || action === "resume")) router.push(result.href); else router.refresh();
    });
  }

  const options = lifecycleOptions(lifecycleStatus, Boolean(deletedAt));
  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <details className="group">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-3 text-xs font-black text-ink transition hover:border-violet hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <MoreHorizontal className="size-4" /> {compact ? <span className="sr-only">Project actions</span> : "Project actions"}
        </summary>
        <div className="absolute right-0 z-20 mt-2 grid min-w-56 gap-1 rounded-2xl border border-ink/10 bg-white p-2 shadow-card">
          {options.map((option) => <button key={option.action} type="button" onClick={() => { setAction(option.action); setMessage(""); }} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition hover:bg-cream ${option.danger ? "text-coral" : "text-ink"}`}>{option.icon}{option.label}</button>)}
        </div>
      </details>
      {message && <p role="status" className="mt-2 max-w-xs text-xs font-semibold leading-5 text-coral">{message}</p>}

      {action && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAction(null); }}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="lifecycle-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/20 bg-white p-5 shadow-glow sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-violet">Project lifecycle</p><h2 id="lifecycle-dialog-title" className="mt-2 font-display text-2xl font-semibold text-ink">{dialogTitle(action)}</h2></div><button ref={closeRef} type="button" onClick={() => setAction(null)} aria-label="Close project lifecycle dialog" className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/10 text-ink hover:bg-cream"><X className="size-4" /></button></div>
          <p className="mt-3 text-sm leading-6 text-ink/60">{dialogDescription(action, title, recoveryExpiresAt)}</p>
          {(action === "pause" || action === "abandon" || action === "restore") && <label className="mt-4 grid gap-2 text-sm font-bold text-ink">Short reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} autoFocus className="min-h-24 rounded-2xl border border-ink/15 p-3 font-normal text-ink" placeholder="What changed?" /></label>}
          {(action === "soft_delete" || action === "permanent_delete") && <label className="mt-4 grid gap-2 text-sm font-bold text-ink">Type the project title to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus className="min-h-11 rounded-2xl border border-coral/30 px-3 font-normal text-ink" placeholder={title} /></label>}
          {(action === "complete" || action === "abandon") && !hasClosureReflection && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">Save the closure reflection in the Progress section first. It preserves the lesson and prevents an empty “completion” click from becoming progress.</div>}
          {message && <p role="alert" className="mt-4 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{message}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setAction(null)} disabled={pending} className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-black text-ink">Cancel</button><button type="button" onClick={submit} disabled={pending || !canSubmit(action, reason, confirmation, title, hasClosureReflection)} className={`min-h-11 rounded-full px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40 ${action.includes("delete") ? "bg-coral" : "bg-ink hover:bg-violet"}`}>{pending ? "Saving…" : confirmLabel(action)}</button></div>
        </section>
      </div>}
    </div>
  );
}

export function LifecycleBadge({ status, deletedAt, currentFocus }: { status: ProjectLifecycleStatus; deletedAt?: string | null; currentFocus?: boolean }) { return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${deletedAt ? "bg-coral/10 text-coral" : currentFocus ? "bg-violet text-white" : "bg-cream text-ink/60"}`}>{deletedAt ? "In recovery" : currentFocus ? "Current focus" : PROJECT_LIFECYCLE_LABELS[status]}</span>; }

function lifecycleOptions(status: ProjectLifecycleStatus, deleted: boolean): Array<{ action: ProjectLifecycleAction; label: string; icon: React.ReactNode; danger?: boolean }> {
  if (deleted) return [{ action: "restore", label: "Restore project", icon: <RotateCcw className="size-4" /> }, { action: "permanent_delete", label: "Delete permanently", icon: <Trash2 className="size-4" />, danger: true }];
  if (status === "paused") return [{ action: "resume", label: "Resume and focus", icon: <RotateCcw className="size-4" /> }, { action: "archive", label: "Archive", icon: <Archive className="size-4" /> }, { action: "soft_delete", label: "Move to recovery", icon: <Trash2 className="size-4" />, danger: true }];
  if (status !== "active") return [{ action: "restore", label: "Restore to active", icon: <RotateCcw className="size-4" /> }, { action: "soft_delete", label: "Move to recovery", icon: <Trash2 className="size-4" />, danger: true }];
  return [{ action: "pause", label: "Pause project", icon: <CirclePause className="size-4" /> }, { action: "complete", label: "Mark completed", icon: <Square className="size-4" /> }, { action: "archive", label: "Archive", icon: <Archive className="size-4" /> }, { action: "abandon", label: "Stop this project", icon: <Square className="size-4" /> }, { action: "soft_delete", label: "Move to recovery", icon: <Trash2 className="size-4" />, danger: true }];
}
function dialogTitle(action: ProjectLifecycleAction) { return ({ pause: "Pause this project?", resume: "Resume this project?", complete: "Complete this project?", archive: "Archive this project?", abandon: "Stop this project?", restore: "Restore this project?", soft_delete: "Move this project to recovery?", permanent_delete: "Permanently delete this project?" } satisfies Record<ProjectLifecycleAction,string>)[action]; }
function dialogDescription(action: ProjectLifecycleAction, title: string, recovery?: string | null) { const descriptions: Record<ProjectLifecycleAction,string> = { pause: "Pause everyday work while keeping the stage, proof, validation path, and history intact.", resume: "Return this project to active work and make it your current focus. No AI call occurs.", complete: "Use this when the intended founder journey is finished. Evidence, Value Proof, decisions, and lessons remain.", archive: "Remove this project from everyday views while preserving its complete history.", abandon: "Preserve what you learned and remove the project from active work. This is a neutral, reversible decision.", restore: "Return the project to active work. Its previous founder stage is retained and its validation path is reviewed deterministically.", soft_delete: `“${title}” will leave ordinary views and remain recoverable for 30 days. Account history stays intact.`, permanent_delete: `This permanently removes “${title}” and its private project content. Sanitized account history may remain without the project content. ${recovery ? `Recovery was available until ${formatRecoveryDate(recovery)}.` : ""}` }; return descriptions[action]; }
function canSubmit(action: ProjectLifecycleAction, reason: string, confirmation: string, title: string, reflection: boolean) { if ((action === "complete" || action === "abandon") && !reflection) return false; if ((action === "pause" || action === "abandon" || action === "restore") && reason.trim().length < 3) return false; if ((action === "soft_delete" || action === "permanent_delete") && confirmation !== title) return false; return true; }
function confirmLabel(action: ProjectLifecycleAction) { return action === "soft_delete" ? "Move to recovery" : action === "permanent_delete" ? "Delete permanently" : action === "abandon" ? "Stop and preserve lessons" : `${action[0].toUpperCase()}${action.slice(1)} project`; }
function clearLocalProjectData(projectId:string){ try{ const exact=[`prismforge_notes_${projectId}`,`prismforge_launch_checklist_${projectId}`,`prismforge_market_pulse_${projectId}`]; exact.forEach((key)=>window.localStorage.removeItem(key)); for(let index=window.localStorage.length-1;index>=0;index-=1){const key=window.localStorage.key(index);if(key?.includes(projectId))window.localStorage.removeItem(key);} }catch{/* Server deletion remains authoritative if browser storage is unavailable. */} }
function formatRecoveryDate(value:string){ const date=new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(date) : "the recovery deadline"; }
