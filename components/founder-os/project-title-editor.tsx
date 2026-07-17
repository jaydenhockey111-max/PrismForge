"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";

type RenameResult = { ok: true; title: string } | { ok: false; error: string };

export function ProjectTitleEditor({
  projectId,
  title,
  action,
}: {
  projectId: string;
  title: string;
  action: (projectId: string, rawTitle: string) => Promise<RenameResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setError(null);
    setValue(displayTitle);
    setIsEditing(true);
    void fetch("/api/beta-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: "project_title_rename_started", metadata: { project_id: projectId } }),
    }).catch(() => undefined);
  }

  function cancelEditing() {
    setError(null);
    setValue(displayTitle);
    setIsEditing(false);
  }

  function saveTitle() {
    setError(null);
    startTransition(async () => {
      const result = await action(projectId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDisplayTitle(result.title);
      setValue(result.title);
      setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <div className="mt-5 min-w-0">
        <div className="group flex flex-wrap items-start gap-3">
          <h1 className="min-w-0 break-words font-display text-4xl font-semibold tracking-tight sm:text-5xl">{displayTitle}</h1>
          <button
            type="button"
            onClick={startEditing}
            className="mt-1 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-cream px-4 text-xs font-black uppercase tracking-[.12em] text-ink/60 transition hover:-translate-y-0.5 hover:bg-gold hover:text-ink"
            aria-label="Rename project"
          >
            <Pencil className="size-3.5" />
            Rename
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold text-ink/45">Clear project names make exports, AI outputs, and beta feedback easier to read.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[1.5rem] border border-violet/15 bg-violet/5 p-4">
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[.14em] text-violet">Project name</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveTitle();
            if (event.key === "Escape") cancelEditing();
          }}
          disabled={isPending}
          autoFocus
          className="min-h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 font-display text-2xl font-semibold text-ink outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/15 disabled:opacity-60"
          maxLength={90}
        />
      </label>
      {error && <p className="mt-3 rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-coral">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveTitle}
          disabled={isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="size-4" />
          {isPending ? "Saving..." : "Save name"}
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/10 bg-white px-5 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="size-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
