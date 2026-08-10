import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const textareaStyle = "min-h-32 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink shadow-[inset_0_1px_2px_rgba(24,26,25,.035)] outline-none transition placeholder:text-ink/35 hover:border-ink/25 focus:border-violet focus:ring-4 focus:ring-violet/10";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} data-slot="textarea" className={cn(textareaStyle, className)} {...props} />;
});
