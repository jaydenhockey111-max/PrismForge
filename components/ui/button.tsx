import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const styles = "inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-[-.01em] transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const variants = {
  primary: "border border-violet/80 bg-violet text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(24,26,25,.12),0_6px_16px_rgba(98,85,231,.18)] hover:bg-[#5649d7] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_3px_rgba(24,26,25,.12),0_8px_20px_rgba(98,85,231,.22)]",
  secondary: "border border-ink/15 bg-white text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(24,26,25,.06)] hover:border-ink/25 hover:bg-cream/60",
  danger: "border border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost: "text-ink hover:bg-ink/5",
};

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={cn(styles, variants[variant], className)} {...props} />;
}

export function ButtonLink({ className, variant = "primary", ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: keyof typeof variants }) {
  return <Link className={cn(styles, variants[variant], className)} {...props} />;
}
