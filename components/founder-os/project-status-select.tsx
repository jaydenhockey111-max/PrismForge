"use client";

import { useState, useTransition } from "react";
import type { ProjectStatus } from "@/lib/founder-os/types";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/founder-os/helpers";

export function ProjectStatusSelect({
  projectId,
  status,
  suggestedStatus,
  disabled = false,
  action,
}: {
  projectId: string;
  status: ProjectStatus;
  suggestedStatus: ProjectStatus;
  disabled?: boolean;
  action: (projectId: string, status: ProjectStatus, reason?: string, requestId?: string) => Promise<{ ok: boolean; error?: string; needsReason?: boolean }>;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  function save(next: ProjectStatus, explanation = "") {
    setMessage("");
    startTransition(async () => {
      const result = await action(projectId, next, explanation, crypto.randomUUID());
      if (!result.ok) {
        setCurrent(status);
        setMessage(result.error ?? "Status could not be saved.");
        if (result.needsReason) setPendingStatus(next);
        return;
      }
      setCurrent(next);
      setPendingStatus(null);
      setReason("");
      setMessage("Status saved.");
    });
  }

  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>Status</span>
      <select
        value={current}
        disabled={pending || disabled}
        onChange={(event) => {
          const next = event.target.value as ProjectStatus;
          if (next !== suggestedStatus) {
            setPendingStatus(next);
            setMessage(`PrismForge suggests ${PROJECT_STATUS_LABELS[suggestedStatus]}. Add a reason if ${PROJECT_STATUS_LABELS[next]} is still accurate.`);
          } else save(next);
        }}
        className="min-h-11 rounded-2xl border border-ink/15 bg-white px-4 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15"
      >
        {PROJECT_STATUSES.map((item) => (
          <option key={item} value={item}>{PROJECT_STATUS_LABELS[item]}</option>
        ))}
      </select>
      <span className="text-xs font-normal text-ink/50">Suggested from saved evidence: <strong>{PROJECT_STATUS_LABELS[suggestedStatus]}</strong></span>
      {pendingStatus && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Why is this stage more accurate?" className="min-h-20 w-full rounded-lg border border-amber-300 bg-white p-2 text-sm text-ink" /><div className="mt-2 flex gap-2"><button type="button" disabled={pending || reason.trim().length < 12} onClick={() => save(pendingStatus, reason)} className="rounded-full bg-ink px-4 py-2 text-xs font-black text-white disabled:opacity-40">Save with reason</button><button type="button" onClick={() => { setPendingStatus(null); setCurrent(status); setReason(""); setMessage(""); }} className="rounded-full border border-ink/15 px-4 py-2 text-xs font-black text-ink">Cancel</button></div></div>}
      {pending && <span className="text-xs font-normal text-ink/50">Saving status...</span>}
      {disabled && <span className="text-xs font-normal text-ink/50">Resume or restore the project before changing its stage.</span>}
      {message && <span role="status" className="text-xs font-semibold text-ink/60">{message}</span>}
    </label>
  );
}
