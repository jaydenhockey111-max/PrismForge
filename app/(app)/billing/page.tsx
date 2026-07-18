import { Check, Sparkles } from "lucide-react";
import { FormMessage } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import { logBetaEvent } from "@/lib/analytics/betaEvents";

export const metadata = { title: "Plan and billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string; error?: string }> }) {
  const [profile, params, supabase] = await Promise.all([requireProfile(), searchParams, createClient()]);
  await logBetaEvent({ userId: profile.id, eventName: "payment_signal_recorded", source: "billing", metadata: { signal: "billing_page_viewed" }, throttleSeconds: 15 * 60 });
  const [{ data: subscription }, { data: xp }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("user_xp").select("premium_trial_until").eq("user_id", profile.id).maybeSingle(),
  ]);
  const entitlements = getEntitlements(profile, xp);
  const trialEnds = entitlements.premiumTrialUntil ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(entitlements.premiumTrialUntil)) : null;
  const founderBetaActive = entitlements.reason === "beta_founder";
  const lifetimeFounderActive = entitlements.reason === "lifetime_founder";

  return <div className="max-w-5xl">
    <FormMessage message={params.success ? "Welcome to Premium! Stripe is confirming your subscription; your plan will update in a moment." : undefined} type="success" />
    <FormMessage message={params.canceled ? "Checkout canceled. Nothing was charged." : params.error} />
    <section className="rounded-[2rem] border border-violet/15 bg-white/80 p-7 shadow-card">
      <p className="eyebrow">Membership</p><h1 className="page-title mt-3">Plan & billing</h1><p className="page-intro mt-4">Payments are intentionally paused during private beta. Use this page to understand your current access and the future plan direction.</p>
    </section>
    {founderBetaActive && <div className="mt-6 rounded-2xl border border-violet/20 bg-violet/10 p-5 text-sm text-ink/70"><span className="font-bold text-ink">Private beta access active:</span> Your account has temporary Founder-level access during the beta test. Complete the beta feedback form to be eligible for lifetime Founder access. This does not grant admin access.</div>}
    {lifetimeFounderActive && <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-5 text-sm text-ink/70"><span className="font-bold text-ink">Lifetime Founder active:</span> Your account has Founder-level access because you completed PrismForge beta feedback. Fair-use AI safety caps still apply.</div>}
    {entitlements.reason === "trial" && <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-5 text-sm text-ink/70"><span className="font-bold text-ink">Reward trial active:</span> You have Pro access until {trialEnds}. You can still upgrade anytime to keep it.</div>}
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <section className={`rounded-[2rem] border bg-white p-7 shadow-card ${!entitlements.hasPremiumAccess ? "border-moss ring-2 ring-moss/10" : "border-ink/10"}`}><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Free</h2>{!entitlements.hasPremiumAccess && <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold">Current plan</span>}</div><p className="mt-5"><span className="font-display text-4xl font-semibold">$0</span><span className="text-ink/50"> forever</span></p><ul className="mt-7 grid gap-3 text-sm"><li className="flex gap-2"><Check className="size-5 text-moss" />Starter founder reports</li><li className="flex gap-2"><Check className="size-5 text-moss" />Opportunity score and MVP plan</li><li className="flex gap-2"><Check className="size-5 text-moss" />Proof Board and project history</li></ul></section>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink via-violet to-moss p-7 text-white shadow-glow"><div className="absolute -right-16 -top-16 size-52 rounded-full bg-gold/20 blur-3xl" /><div className="relative"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Pro / Founder beta</h2>{entitlements.hasPremiumAccess ? <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-ink">{lifetimeFounderActive ? "Lifetime Founder" : founderBetaActive ? "Founder beta" : entitlements.reason === "trial" ? "Trial active" : "Current plan"}</span> : <Sparkles className="text-gold" />}</div><p className="mt-5"><span className="font-display text-4xl font-semibold">$15+</span><span className="text-white/50"> / month later</span></p><ul className="mt-7 grid gap-3 text-sm"><li className="flex gap-2"><Check className="size-5 text-gold" />More founder reports with safety caps</li><li className="flex gap-2"><Check className="size-5 text-gold" />Cross-project evidence and learning</li><li className="flex gap-2"><Check className="size-5 text-gold" />Advanced launch tracking and exports</li></ul>
        <div className="mt-7 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/75">Checkout is paused for beta. No tester should be charged from this flow.</div>
      </div></section>
    </div>
    {subscription && <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 text-sm text-ink/60"><span className="font-bold text-ink">Subscription status:</span> {subscription.status}{subscription.cancel_at_period_end ? " · Cancels at the end of the billing period" : ""}</div>}
  </div>;
}
