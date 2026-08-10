"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { BetaHandbook } from "@/components/beta-handbook";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

const BETA_GUIDE_SEEN_KEY = "prismforge_beta_guide_seen_v1";

export function BetaGuideLauncher({ autoOpen = false, compactButton = false }: { autoOpen?: boolean; compactButton?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (window.localStorage.getItem(BETA_GUIDE_SEEN_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [autoOpen]);

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

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeGuide(); }}>
        <DialogContent className="max-w-5xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <DialogTitle>Beta testing guide</DialogTitle>
              <DialogClose
                className="border-0 bg-white text-ink/60 hover:bg-ink hover:text-white"
                aria-label="Close beta guide"
              >
                <X className="size-4" />
              </DialogClose>
            </div>
            <BetaHandbook compact />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Link href="/beta-guide" onClick={closeGuide} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-md">
                Open full guide page
              </Link>
              <Button type="button" onClick={closeGuide}>Start testing</Button>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
