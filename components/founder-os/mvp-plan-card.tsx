import { CheckCircle2, Hammer, XCircle } from "lucide-react";
import type { MvpPlan } from "@/lib/founder-os/types";

export function MvpPlanCard({ plan }: { plan: MvpPlan }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ListPanel icon={<CheckCircle2 className="size-5 text-moss" />} title="Must build" items={plan.mustHaveFeatures} />
      <ListPanel icon={<XCircle className="size-5 text-coral" />} title="Do not build yet" items={plan.doNotBuildYet} />
      <ListPanel icon={<Hammer className="size-5 text-violet" />} title="7-day build plan" items={plan.sevenDayBuildPlan} />
      <ListPanel icon={<Hammer className="size-5 text-gold" />} title="30-day launch plan" items={plan.thirtyDayLaunchPlan} />
      <div className="rounded-2xl border border-ink/10 bg-cream/45 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold">Technical complexity</p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink shadow-sm">{plan.technicalComplexity}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.suggestedStack.map((item) => (
            <span key={item} className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-bold text-ink/70">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListPanel({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-xl font-semibold">{title}</h3>
      </div>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
