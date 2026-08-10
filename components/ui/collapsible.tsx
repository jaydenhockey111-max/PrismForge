"use client";

import type { ComponentProps } from "react";
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";

export function Collapsible({ className, ...props }: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" className={cn("rounded-2xl border", className)} {...props} />;
}

export function CollapsibleTrigger({ className, ...props }: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2", className)} {...props} />;
}

export function CollapsibleContent({ className, ...props }: ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" className={cn("motion-collapsible px-4 pb-4", className)} {...props} />;
}
