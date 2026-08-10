import type { AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-[-.01em] transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  {
    variants: {
      variant: {
        default: "border border-violet/80 bg-violet text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(24,26,25,.12),0_6px_16px_rgba(98,85,231,.18)] hover:bg-[#5649d7] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_3px_rgba(24,26,25,.12),0_8px_20px_rgba(98,85,231,.22)]",
        primary: "border border-violet/80 bg-violet text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_1px_2px_rgba(24,26,25,.12),0_6px_16px_rgba(98,85,231,.18)] hover:bg-[#5649d7] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_3px_rgba(24,26,25,.12),0_8px_20px_rgba(98,85,231,.22)]",
        secondary: "border border-ink/15 bg-white text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(24,26,25,.06)] hover:border-ink/25 hover:bg-cream/60",
        outline: "border border-ink/15 bg-white text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(24,26,25,.06)] hover:border-ink/25 hover:bg-cream/60",
        danger: "border border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700",
        destructive: "border border-red-700 bg-red-600 text-white shadow-sm hover:bg-red-700",
        ghost: "text-ink hover:bg-ink/5",
        link: "min-h-0 px-0 text-violet underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 min-h-0 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export function ButtonLink({ className, variant = "default", size = "default", ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string } & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
