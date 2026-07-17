import { ArrowRight, Check, CheckCircle2, ClipboardCheck, Compass, Lightbulb } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { APP_NAME } from "@/lib/brand";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (profile) {
    await logBetaEvent({
      userId: profile.id,
      eventName: "landing_auth_state_rendered",
      source: "landing_page",
      metadata: { authenticated: true, profile_exists: true, target_route: "/start" },
      throttleSeconds: 15 * 60,
    });
  }

  return (
    <main>
      <section className="paper-grid border-b border-ink/10">
        <div className="mx-auto grid max-w-7xl gap-16 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-32">
          <div className="max-w-3xl">
            <p className="eyebrow inline-flex items-center gap-2"><Compass className="size-4" />A practical founder workspace</p>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[.96] tracking-[-.055em] text-ink sm:text-7xl">
              Stop circling the idea. Test what matters.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-ink/62">
              {APP_NAME} turns a vague business idea into one clear uncertainty, one realistic test, and one useful next action—then keeps the evidence organized as you learn.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/start" className="gap-2">Start your first project <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary">See the workflow</ButtonLink>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/50">
              {["Free to start", "No credit card", "No automatic AI calls"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><Check className="size-4 text-violet" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[1.75rem] border border-ink/10 bg-white p-4 shadow-glow sm:p-5">
              <div className="flex items-center justify-between border-b border-ink/10 px-2 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-ink/40">Current project</p>
                  <p className="mt-1 font-semibold text-ink">Student study planner</p>
                </div>
                <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-bold text-violet">Testing</span>
              </div>
              <div className="grid gap-3 pt-4">
                <div className="rounded-2xl bg-cream/75 p-5">
                  <p className="text-xs font-bold uppercase tracking-[.15em] text-ink/40">Biggest uncertainty</p>
                  <p className="mt-3 font-display text-xl font-semibold leading-7 tracking-[-.02em] text-ink">
                    Will students use a planning workflow before a difficult exam?
                  </p>
                </div>
                <div className="rounded-2xl border border-violet/15 bg-violet/[.055] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[.15em] text-violet">Next action</p>
                    <span className="text-xs font-semibold text-ink/45">20 min</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-ink/75">
                    Talk to three students and record how they decide what to study.
                  </p>
                </div>
                <div className="flex items-center gap-3 px-2 py-2 text-sm font-semibold text-ink/58">
                  <CheckCircle2 className="size-5 text-moss" />
                  Evidence—not activity—changes the recommendation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
          <div className="max-w-xl">
            <p className="eyebrow">The core loop</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-[-.04em] text-ink sm:text-5xl">
              From rough idea to useful evidence in one sitting.
            </h2>
            <p className="mt-6 leading-7 text-ink/58">
              Each step removes uncertainty. Nothing is labeled validated just because a plan exists.
            </p>
          </div>
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {[
              [Lightbulb, "01", "Clarify the uncertainty", "Structure the idea and identify the biggest question that is still unproven."],
              [ClipboardCheck, "02", "Prepare one realistic test", "Get a specific action, completion condition, and evidence requirement."],
              [CheckCircle2, "03", "Record what happened", "Save real-world signals and see exactly why the next recommendation changed."],
            ].map(([Icon, number, title, copy]) => {
              const I = Icon as typeof Lightbulb;
              return (
                <article key={String(number)} className="grid gap-4 py-7 sm:grid-cols-[3rem_1fr] sm:py-8">
                  <span className="text-sm font-bold text-violet">{String(number)}</span>
                  <div>
                    <div className="flex items-center gap-3">
                      <I className="size-5 text-ink/45" />
                      <h3 className="text-lg font-bold tracking-[-.015em] text-ink">{String(title)}</h3>
                    </div>
                    <p className="mt-3 max-w-xl leading-7 text-ink/58">{String(copy)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 px-5 py-16 sm:flex-row sm:items-center lg:px-8 lg:py-20">
          <div>
            <p className="eyebrow">Start small</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-.03em] text-ink sm:text-4xl">
              Test the riskiest assumption before you overbuild.
            </h2>
          </div>
          <ButtonLink href="/start" className="shrink-0 gap-2">Start a project <ArrowRight className="size-4" /></ButtonLink>
        </div>
      </section>
    </main>
  );
}
