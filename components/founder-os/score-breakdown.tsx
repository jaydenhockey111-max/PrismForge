import type { OpportunityScore } from "@/lib/founder-os/types";

export function ScoreBreakdown({ score }: { score: OpportunityScore }) {
  return (
    <div className="grid gap-3">
      <p className="rounded-2xl border border-violet/10 bg-violet/5 p-4 text-sm font-semibold leading-6 text-ink/65">
        These are planning signals. They help decide what to test next; real evidence only comes from user conversations, commitments, payment intent, or revenue.
      </p>
      {score.breakdown.map((item) => (
        <div key={item.key} className="rounded-2xl border border-ink/10 bg-cream/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">{item.label}</p>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-ink shadow-sm">{item.score}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-gradient-to-r from-violet to-moss" style={{ width: `${item.score}%` }} />
          </div>
          <p className="mt-3 text-sm leading-6 text-ink/60">{item.explanation}</p>
        </div>
      ))}
    </div>
  );
}
