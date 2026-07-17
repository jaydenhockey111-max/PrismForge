"use client";

import { useState } from "react";

export function CopySectionButton({ text, label = "Copy section", analyticsEventName, projectId }: { text: string; label?: string; analyticsEventName?: string; projectId?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (analyticsEventName) {
        void fetch("/api/beta-events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventName: analyticsEventName, metadata: { project_id: projectId ?? null, label } }),
          keepalive: true,
        });
      }
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-sm">
      {copied ? "Copied!" : label}
    </button>
  );
}
