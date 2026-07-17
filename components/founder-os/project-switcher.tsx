"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FolderKanban } from "lucide-react";
import { focusProject } from "@/app/(app)/projects/lifecycle-actions";

export function ProjectSwitcher({
  projects,
  currentProjectId,
}: {
  projects: Array<{ id: string; title: string }>;
  currentProjectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const current = projects.find((project) => project.id === currentProjectId) ?? null;

  function select(projectId: string) {
    setMessage("");
    void logEvent("project_switcher_project_selected");
    startTransition(async () => {
      const result = await focusProject(projectId, crypto.randomUUID(), "project_switcher");
      if (!result.ok) {
        setMessage(result.error ?? "Could not switch projects.");
        return;
      }
      router.push(`/projects/${projectId}?section=today`);
      router.refresh();
    });
  }

  return (
    <details
      className="relative"
      onToggle={(event) => {
        if (event.currentTarget.open) void logEvent("project_switcher_opened");
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream/70 px-3 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
        <span className="flex min-w-0 items-center gap-2">
          <FolderKanban className="size-4 shrink-0 text-violet" />
          <span className="truncate">{current?.title ?? "Choose current project"}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink/45" />
      </summary>
      <div className="absolute left-0 right-0 z-30 mt-2 grid min-w-56 gap-1 rounded-xl border border-ink/10 bg-white p-2 shadow-card">
        {projects.slice(0, 6).map((project) => (
          <button
            type="button"
            key={project.id}
            disabled={pending || project.id === currentProjectId}
            onClick={() => select(project.id)}
            className="truncate rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-cream disabled:text-violet"
          >
            {project.title}{project.id === currentProjectId ? " · Current" : ""}
          </button>
        ))}
        <Link href="/projects" className="rounded-lg border-t border-ink/10 px-3 py-2 text-sm font-bold text-violet hover:bg-cream">
          View all projects
        </Link>
        {message && <p role="status" className="px-3 py-2 text-xs font-semibold text-coral">{message}</p>}
      </div>
    </details>
  );
}

async function logEvent(eventName: string) {
  try {
    await fetch("/api/beta-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, metadata: { source: "project_switcher" } }),
    });
  } catch {
    // Analytics never blocks switching.
  }
}
