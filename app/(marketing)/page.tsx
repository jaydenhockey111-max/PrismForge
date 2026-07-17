import { ArrowRight, CheckCircle2, ClipboardCheck, Compass, Lightbulb } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { APP_NAME } from "@/lib/brand";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (profile) {
    await logBetaEvent({ userId: profile.id, eventName: "landing_auth_state_rendered", source: "landing_page", metadata: { authenticated: true, profile_exists: true, target_route: "/start" }, throttleSeconds: 15 * 60 });
  }

  return (
    <main>
      <section className="paper-grid overflow-hidden border-b border-ink/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-violet/20 bg-white px-4 py-2 text-sm font-black text-violet"><Compass className="size-4" />A practical founder workspace</p>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[.98] tracking-[-.04em] text-ink sm:text-7xl">Know exactly what to test next.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/65">{APP_NAME} helps first-time founders turn a vague idea into one clear assumption, one realistic test, and one useful next action. Your evidence and decisions stay organized as the project changes.</p>
            <div className="mt-9 flex flex-wrap gap-3"><ButtonLink href="/start" className="gap-2 bg-violet hover:bg-ink">Create your first project <ArrowRight className="size-4" /></ButtonLink><ButtonLink href="#how-it-works" variant="secondary">See the 20-minute loop</ButtonLink></div>
            <p className="mt-4 text-sm font-semibold text-ink/50">Free to start · No credit card required · No automatic AI calls</p>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -right-8 -top-8 size-40 rounded-full bg-violet/20 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 size-44 rounded-full bg-gold/25 blur-3xl" />
            <div className="relative rounded-[2rem] border border-ink/10 bg-white p-6 shadow-glow sm:p-7">
              <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Example founder loop</p>
              <div className="mt-5 rounded-2xl bg-cream/60 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-ink/45">Biggest question</p><p className="mt-2 font-display text-xl font-semibold text-ink">Will students use a planning workflow before a difficult exam?</p></div>
              <div className="mt-3 rounded-2xl border border-moss/15 bg-lime/20 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-moss">Next action</p><p className="mt-2 text-sm font-bold leading-6 text-ink/75">Talk to three students and record how they decide what to study.</p></div>
              <div className="mt-5 flex items-center gap-3 text-sm font-black text-ink"><CheckCircle2 className="size-5 text-moss" />Evidence changes the recommendation.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[.18em] text-violet">The core loop</p><h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">From rough idea to a useful test in one sitting.</h2></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [Lightbulb, "Clarify the uncertainty", "PrismForge structures your idea and identifies the biggest question that is still unproven."],
            [ClipboardCheck, "Prepare one realistic test", "Get a specific action, completion condition, evidence requirement, and the support needed to begin."],
            [CheckCircle2, "Record what actually happened", "Save evidence and see why the next recommendation changed. PrismForge never labels an idea validated from a plan alone."],
          ].map(([Icon, title, copy]) => { const I = Icon as typeof Lightbulb; return <article key={String(title)} className="rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card"><I className="size-8 text-violet" /><h3 className="mt-6 text-xl font-black text-ink">{String(title)}</h3><p className="mt-3 leading-7 text-ink/60">{String(copy)}</p></article>; })}
        </div>
      </section>

      <section className="bg-ink text-white"><div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center lg:px-8"><div><p className="text-xs font-black uppercase tracking-[.16em] text-lime">Start small</p><h2 className="mt-2 font-display text-3xl font-semibold">Test the riskiest assumption before you overbuild.</h2></div><ButtonLink href="/start" className="shrink-0 bg-gold text-ink hover:bg-white">Start creating</ButtonLink></div></section>
    </main>
  );
}
