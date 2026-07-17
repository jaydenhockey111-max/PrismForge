import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const styles = "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const variants = {
  primary: "bg-gradient-to-r from-ink via-moss to-ink bg-[length:180%_100%] text-white hover:bg-right",
  secondary: "border border-ink/15 bg-white text-ink hover:border-ink/40",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-ink hover:bg-ink/5",
};

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button className={cn(styles, variants[variant], className)} {...props} />;
}

export function ButtonLink({ className, variant = "primary", ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: keyof typeof variants }) {
  return <Link className={cn(styles, variants[variant], className)} {...props} />;
}
