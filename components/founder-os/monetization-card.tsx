import { CreditCard, TrendingUp } from "lucide-react";
import type { MonetizationPlan } from "@/lib/founder-os/types";

export function MonetizationCard({ plan }: { plan: MonetizationPlan }) {
  return (
    <div>
      <p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-ink/45">Generated pricing assumptions</p>
      <div className="grid gap-4 md:grid-cols-3">
        {plan.tierFeatureMap.map((tier) => (
          <div key={tier.tier} className="rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl font-semibold">{tier.tier}</h3>
              <CreditCard className="size-5 text-violet" />
            </div>
            <p className="mt-3 text-2xl font-black">{tier.price}</p>
            <ul className="mt-4 grid gap-2 text-sm text-ink/65">
              {tier.features.map((feature) => <li key={feature}>• {feature}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-moss/15 bg-lime/30 p-5">
        <div className="flex items-center gap-2 font-bold text-moss">
          <TrendingUp className="size-5" />
          Why people would pay
        </div>
        <p className="mt-3 leading-7 text-ink/65">{plan.whyUsersWouldPay}</p>
        <p className="mt-3 text-sm leading-6 text-ink/55">{plan.upsellStrategy}</p>
      </div>
    </div>
  );
}
