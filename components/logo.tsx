import Link from "next/link";
import { Diamond } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-3 font-display text-lg font-bold tracking-[-.025em] text-ink">
      <span className="relative grid size-9 place-items-center rounded-xl border border-violet/80 bg-violet text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_1px_2px_rgba(24,26,25,.12),0_5px_12px_rgba(98,85,231,.15)] transition duration-200 group-hover:-translate-y-px">
        <Diamond className="size-[1.125rem]" strokeWidth={2.25} />
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
