"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RewardChestReveal({ reward, description, level }: { reward?: string; description?: string; level?: string }) {
  const [open, setOpen] = useState(Boolean(reward));
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setOpen(true);
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), 900);
    const closeTimer = window.setTimeout(() => setOpen(false), 8000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(closeTimer);
    };
  }, [reward]);

  if (!open || !reward) return null;

  return (
    <div className="fixed inset-0 z-[9000] grid place-items-center bg-ink/65 px-5 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Reward chest opened">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-gold/40 bg-gradient-to-br from-white via-cream to-gold/20 p-7 text-center shadow-glow animate-reward-pop">
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-ink/50 hover:text-ink" aria-label="Close reward reveal">
          <X className="size-4" />
        </button>

        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-8 top-10 size-2 rounded-full bg-gold animate-confetti-one" />
          <div className="absolute right-14 top-16 size-2 rounded-full bg-violet animate-confetti-two" />
          <div className="absolute bottom-20 left-16 size-2 rounded-full bg-moss animate-confetti-three" />
          <div className="absolute bottom-14 right-20 size-2 rounded-full bg-coral animate-confetti-two" />
        </div>

        <p className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.18em] text-violet">
          <Sparkles className="size-4" />
          {level ? `Level ${level} reward` : "Reward chest"}
        </p>

        <div className="mx-auto mt-6 h-36 w-44 perspective-1000" aria-hidden="true">
          <div className={`relative mx-auto h-28 w-36 rounded-b-3xl border-4 border-amber-900 bg-gradient-to-br from-amber-500 to-amber-700 shadow-2xl ${revealed ? "animate-chest-bounce" : "animate-chest-idle"}`}>
            <div className={`absolute -top-10 left-0 h-14 w-36 origin-bottom rounded-t-[2rem] border-4 border-amber-900 bg-gradient-to-br from-amber-400 to-amber-700 transition duration-700 ${revealed ? "-rotate-45 -translate-y-4" : ""}`} />
            <div className="absolute left-1/2 top-8 grid size-10 -translate-x-1/2 place-items-center rounded-xl border-4 border-amber-900 bg-gold text-lg">✦</div>
            <div className={`absolute left-1/2 top-2 h-24 w-24 -translate-x-1/2 rounded-full bg-gold/70 blur-2xl transition duration-700 ${revealed ? "scale-150 opacity-100" : "scale-50 opacity-0"}`} />
          </div>
        </div>

        <h2 className={`mt-2 font-display text-4xl font-semibold transition duration-700 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>{reward}</h2>
        <p className={`mx-auto mt-3 max-w-md leading-7 text-ink/60 transition delay-150 duration-700 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>{description ?? "Your reward is active on your account."}</p>
        <Button onClick={() => setOpen(false)} className="mt-7 bg-violet hover:bg-ink">Awesome</Button>
      </div>
    </div>
  );
}
