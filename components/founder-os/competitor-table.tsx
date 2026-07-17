import type { Competitor } from "@/lib/founder-os/types";

export function CompetitorTable({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="rounded-2xl border border-ink/10">
      <div className="border-b border-ink/10 bg-violet/5 px-4 py-3 text-sm font-semibold leading-6 text-ink/65">
        Hypothesis, not verified competitive research. Use this as a shortlist of alternatives to investigate.
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-cream text-xs uppercase tracking-[.14em] text-ink/50">
          <tr>
            <th className="px-4 py-3">Competitor</th>
            <th className="px-4 py-3">What they do</th>
            <th className="px-4 py-3">Strength</th>
            <th className="px-4 py-3">Weakness</th>
            <th className="px-4 py-3">Pricing</th>
            <th className="px-4 py-3">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10 bg-white">
          {competitors.map((competitor) => (
            <tr key={competitor.name} className="align-top">
              <td className="px-4 py-4 font-bold">{competitor.name}</td>
              <td className="px-4 py-4 text-ink/60">{competitor.whatTheyDo}</td>
              <td className="px-4 py-4 text-ink/60">{competitor.strength}</td>
              <td className="px-4 py-4 text-ink/60">{competitor.weakness}</td>
              <td className="px-4 py-4 font-semibold">{competitor.pricing}</td>
              <td className="px-4 py-4 text-moss">{competitor.opportunityGap}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
