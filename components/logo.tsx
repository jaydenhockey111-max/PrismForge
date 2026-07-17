import Link from "next/link";
import { Hammer, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-3 font-display text-xl font-bold tracking-tight text-ink">
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet via-gold to-lime text-ink shadow-glow transition duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
        <Sparkles className="absolute right-1 top-1 size-3 text-white/85" />
        <Hammer className="size-5" />
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
