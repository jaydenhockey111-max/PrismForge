import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const inputStyle = "min-h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-base text-ink shadow-[inset_0_1px_2px_rgba(24,26,25,.035)] outline-none transition placeholder:text-ink/35 hover:border-ink/25 focus:border-violet focus:ring-4 focus:ring-violet/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} data-slot="input" className={cn(inputStyle, className)} {...props} />;
});
