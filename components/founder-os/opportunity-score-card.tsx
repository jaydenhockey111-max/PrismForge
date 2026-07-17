import { Gauge, Sparkles } from "lucide-react";
import { ScoreBreakdown } from "@/components/founder-os/score-breakdown";
import type { OpportunityScore } from "@/lib/founder-os/types";

export function OpportunityScoreCard({ score }: { score: OpportunityScore }) {
  const label = score.overall >= 85 ? "Strong starting structure" : score.overall >= 70 ? "Clear enough to test" : score.overall >= 55 ? "Needs evidence" : "Needs sharper focus";

  return (
    <div className="overflow-hidden rounded-[2rem] border border-ink/10 bg-ink text-white shadow-glow">
      <div className="relative p-7">
        <div className="absolute -right-16 -top-16 size-52 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-gold">
              <Sparkles className="size-4" />
              Planning signal
            </div>
            <p className="mt-3 font-display text-6xl font-semibold tracking-tight">{score.overall}</p>
            <p className="mt-2 text-white/70">{label}. This organizes your plan; it is not proof that customers want it.</p>
          </div>
          <div className="grid size-14 place-items-center rounded-2xl bg-white/10 text-gold">
            <Gauge />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 bg-white p-5 text-ink">
        <details className="mb-4 rounded-2xl border border-violet/10 bg-violet/5 p-4">
          <summary className="cursor-pointer text-sm font-black text-violet">How this works</summary>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-ink/65">
            <p><span className="font-black text-ink">Based on:</span> your project type, audience, budget, time, skills, risk tolerance, and plan completeness.</p>
            <p><span className="font-black text-ink">Not based on:</span> live market research, real customer demand, revenue, or guaranteed success.</p>
            <p><span className="font-black text-ink">Improve it by:</span> narrowing the audience, cutting MVP scope, and logging real proof in the Proof Board.</p>
          </div>
        </details>
        <ScoreBreakdown score={score} />
      </div>
    </div>
  );
}
