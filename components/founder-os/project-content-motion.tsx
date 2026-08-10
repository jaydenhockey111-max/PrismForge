"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { CoreLoopMotionConfig } from "@/components/founder-os/next-move-motion";

export function ProjectContentMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const projectId = pathname?.match(/^\/projects\/([^/]+)/)?.[1] ?? null;

  if (!projectId) return children;

  return (
    <CoreLoopMotionConfig>
      <AnimatePresence mode="wait">
        <motion.div
          key={projectId}
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
