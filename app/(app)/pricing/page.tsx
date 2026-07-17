import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import { logBetaEvent } from "@/lib/analytics/betaEvents";

export const metadata = { title: "Pricing" };

const tiers = [
  {
    name: "Free",
    price: "$0",
    icon: <Sparkles className="size-5" />,
    description: "For curious founders validating one idea at a time.",
    features: ["3 founder reports/month", "Basic founder score", "Basic MVP plan", "Limited saved projects"],
    action: "Current starter plan",
    href: "/generate",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$15/mo",
    icon: <Zap className="size-5" />,
    description: "For builders who want organized progress across several active ideas.",
    features: ["More saved projects", "Progress tracking across projects", "AI strategy with safety caps", "Proof Board history", "Next Best Action and Outreach Kit", "Exports and saved outputs"],
    action: "Beta payments paused",
    href: "/billing",
    highlighted: true,
  },
  {
    name: "Founder",
    price: "$49/mo",
    icon: <Crown className="size-5" />,
    description: "For serious operators turning validation, proof, and launch work into a repeatable system.",
    features: ["Everything in Pro", "Higher beta AI limits", "Deeper founder progress insights", "Launch Command Center", "First Dollar Sprint", "Local Market Pulse preview"],
    action: "View beta access",
    href: "/pricing",
    highlighted: false,
  },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  await logBetaEvent({ userId: profile.id, eventName: "payment_signal_recorded", source: "pricing", metadata: { signal: "plan_comparison_viewed" }, throttleSeconds: 15 * 60 });

  return (
    <div>
      <FormMessage message={params.error} />
      <section className="rounded-[2rem] border border-ink/10 bg-ink p-8 text-center text-white shadow-glow">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-[.16em] text-gold">
          <Sparkles className="size-4" />
          Pricing
        </div>
        <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">Simple beta pricing assumptions.</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/65">Payments are paused during beta. These tiers show the intended product direction so testers can judge whether the value makes sense.</p>
        <p className="mt-4 text-sm text-white/45">Current account plan: {profile.plan}</p>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {tiers.map((tier) => (
          <section key={tier.name} className={`relative overflow-hidden rounded-[2rem] border p-7 shadow-card ${tier.highlighted ? "border-violet bg-gradient-to-br from-white to-violet/10 ring-4 ring-violet/10" : "border-ink/10 bg-white"}`}>
            {tier.highlighted && <div className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-xs font-black">Best value</div>}
            <div className="grid size-12 place-items-center rounded-2xl bg-ink text-gold">{tier.icon}</div>
            <h2 className="mt-5 font-display text-3xl font-semibold">{tier.name}</h2>
            <p className="mt-3"><span className="font-display text-5xl font-semibold">{tier.price}</span></p>
            <p className="mt-3 min-h-14 text-sm leading-6 text-ink/60">{tier.description}</p>
            <ul className="mt-6 grid gap-3 text-sm">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-moss" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href={tier.href} className={`mt-7 w-full ${tier.name !== "Free" ? "pointer-events-none opacity-70" : ""}`} variant={tier.highlighted ? "primary" : "secondary"}>
              {tier.action}
            </ButtonLink>
            {tier.name !== "Free" && <p className="mt-3 text-center text-xs text-ink/45">Private beta accounts may receive temporary Founder-style access while payment setup is finalized.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
