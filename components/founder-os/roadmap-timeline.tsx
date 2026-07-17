import type { ExecutionRoadmap } from "@/lib/founder-os/types";

export function RoadmapTimeline({ roadmap }: { roadmap: ExecutionRoadmap }) {
  const groups = [
    ["Today", roadmap.today],
    ["This week", roadmap.thisWeek],
    ["This month", roadmap.thisMonth],
    ["First 100 users", roadmap.first100UsersPlan],
    ["First $1,000", roadmap.first1000RevenuePlan],
    ["Risks", roadmap.biggestRisks],
    ["Fast tests", roadmap.howToTestQuickly],
  ] as const;

  return (
    <div className="grid gap-4">
      {groups.map(([title, items], index) => (
        <div key={title} className="relative rounded-2xl border border-ink/10 bg-white p-5">
          <div className="flex gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-white">{index + 1}</div>
            <div>
              <h3 className="font-display text-xl font-semibold">{title}</h3>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink/65">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
