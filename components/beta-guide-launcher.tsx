"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { BetaHandbook } from "@/components/beta-handbook";
import { Button } from "@/components/ui/button";

const BETA_GUIDE_SEEN_KEY = "prismforge_beta_guide_seen_v1";

export function BetaGuideLauncher({ autoOpen = false, compactButton = false }: { autoOpen?: boolean; compactButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (window.localStorage.getItem(BETA_GUIDE_SEEN_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeGuide();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeGuide() {
    try {
      window.localStorage.setItem(BETA_GUIDE_SEEN_KEY, "1");
    } catch {
      // Non-critical beta helper.
    }
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className={compactButton ? "min-h-10 px-4 text-xs" : "gap-2"}>
        <BookOpen className="size-4" />
        How to test PrismForge
      </Button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] grid place-items-center bg-ink/75 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-guide-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGuide();
          }}
        >
          <section className="relative z-[10000] max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/40 bg-cream p-4 text-ink shadow-glow sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="beta-guide-title" className="font-display text-2xl font-semibold">Beta testing guide</h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeGuide}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink/60 transition hover:bg-ink hover:text-white"
                aria-label="Close beta guide"
              >
                <X className="size-4" />
              </button>
            </div>
            <BetaHandbook compact />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Link href="/beta-guide" onClick={closeGuide} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-md">
                Open full guide page
              </Link>
              <Button type="button" onClick={closeGuide}>Start testing</Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
