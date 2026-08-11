"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useFormStatus } from "react-dom";
import { CoreLoopMotionConfig } from "@/components/founder-os/next-move-motion";
import {
  createProjectCreationSlowTimer,
  isProjectCreationLoading,
  transitionProjectCreationLifecycle,
  type ProjectCreationLifecycleState,
} from "@/lib/founder-os/projectCreationLifecycle";
import { PROJECT_CREATION_SLOW_AFTER_MS } from "@/lib/founder-os/createProjectFeedback";

export function LoadingGenerationState() {
  const { pending } = useFormStatus();
  const [state, setState] = useState<ProjectCreationLifecycleState>("IDLE");
  const slowTimer = useRef<ReturnType<typeof createProjectCreationSlowTimer> | null>(null);
  let timer = slowTimer.current;
  if (timer === null) {
    timer = createProjectCreationSlowTimer({
      onSlow: () => setState((current) => transitionProjectCreationLifecycle(current, "SLOW")),
      slowAfterMs: PROJECT_CREATION_SLOW_AFTER_MS,
    });
    slowTimer.current = timer;
  }

  useEffect(() => {
    if (pending) {
      setState((current) => transitionProjectCreationLifecycle(current, "SUBMIT"));
      timer.start();
      return;
    }

    timer.complete();
    setState((current) => transitionProjectCreationLifecycle(current, "COMPLETE"));
  }, [pending, timer]);

  useEffect(() => () => timer.dispose(), [timer]);

  if (!isProjectCreationLoading(state)) return null;

  return (
    <CoreLoopMotionConfig>
      <motion.div id="project-creation-status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[1.5rem] border border-violet/20 bg-white p-5 shadow-card" role="status" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[.16em] text-violet">Creating your project...</p>
            <p className="mt-2 font-display text-2xl font-semibold">Preparing your first Next Move...</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Keep this tab open. PrismForge will take you to the project as soon as it is ready.</p>
            {state === "SLOW" && <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">Still working — this is taking a little longer than usual.</p>}
          </div>
          <div className="grid size-12 place-items-center rounded-2xl bg-ink text-gold">
            <div className="size-5 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
          </div>
        </div>
      </motion.div>
    </CoreLoopMotionConfig>
  );
}
