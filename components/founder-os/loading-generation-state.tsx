"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useFormStatus } from "react-dom";
import { CoreLoopMotionConfig } from "@/components/founder-os/next-move-motion";

export function LoadingGenerationState() {
  const { pending } = useFormStatus();
  const [clientStarted, setClientStarted] = useState(false);
  const active = pending || clientStarted;

  useEffect(() => {
    function onStarted() {
      setClientStarted(true);
    }
    window.addEventListener("prismforge:project-submit-clicked", onStarted);
    return () => window.removeEventListener("prismforge:project-submit-clicked", onStarted);
  }, []);

  if (!active) return null;

  return (
    <CoreLoopMotionConfig>
      <motion.div id="project-creation-status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[1.5rem] border border-violet/20 bg-white p-5 shadow-card" role="status" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[.16em] text-violet">Creating your project</p>
            <p className="mt-2 font-display text-2xl font-semibold">Preparing your first Next Move</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Keep this tab open. PrismForge will take you to the project as soon as it is ready.</p>
          </div>
          <div className="grid size-12 place-items-center rounded-2xl bg-ink text-gold">
            <div className="size-5 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
          </div>
        </div>
      </motion.div>
    </CoreLoopMotionConfig>
  );
}
