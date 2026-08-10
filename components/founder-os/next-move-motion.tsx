"use client";

import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

export const coreLoopMotionTransition = { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] as const };

export function CoreLoopMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={coreLoopMotionTransition}>{children}</MotionConfig>;
}

export function NextMoveMotion({ recommendationId, children }: { recommendationId: string; children: ReactNode }) {
  return (
    <CoreLoopMotionConfig>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={recommendationId}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </CoreLoopMotionConfig>
  );
}
