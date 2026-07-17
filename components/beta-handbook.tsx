import { CheckCircle2, Compass, FlaskConical, MessageCircle, Radar, Rocket, ShieldCheck, Sparkles, Users } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export const betaQuestSteps = [
  "Create one project.",
  "Open the project page.",
  "Try CEO AI.",
  "Generate a Validation Survey.",
  "Add one Proof Board experiment.",
  "Check Local Market Pulse preview.",
  "Review Launch Command Center.",
  "Submit feedback.",
] as const;

export function BetaHandbook({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-5" : "grid gap-7"}>
      <section className="prism-shell rounded-[2rem] border border-ink/10 bg-ink p-6 text-white shadow-glow sm:p-8">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-gold">
          <Sparkles className="size-4 animate-sparkle" />
          {APP_NAME} Beta Handbook
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">How to test PrismForge</h1>
        <p className="mt-4 max-w-3xl leading-7 text-white/78">
          PrismForge is an AI Founder Operating System. The beta goal is simple: turn an idea into a project, use the AI team and execution tools, collect real-world proof, then decide what to do next.
        </p>
      </section>

      <section className="rounded-[2rem] border border-violet/15 bg-white p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[.16em] text-violet">The core loop</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {betaQuestSteps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-2xl border border-ink/10 bg-cream/55 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-black text-white">{index + 1}</span>
              <p className="pt-1 text-sm font-semibold leading-6 text-ink/80">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <HandbookCard icon={<Rocket className="size-5" />} title="Generate a project" text="Use a real idea or a fake one. The report gives you the business angle, MVP plan, pricing assumptions, content hooks, and launch roadmap." />
        <HandbookCard icon={<Users className="size-5" />} title="Consult the AI team" text="CEO, Marketer, Designer, and Engineer AI only run when you click. Cached results appear later so beta testing does not accidentally burn credits." />
        <HandbookCard icon={<FlaskConical className="size-5" />} title="Use the Execution Suite" text="Generate practical assets like validation surveys, pricing tiers, competitive battlecards, video scripts, and sprint tasks." />
        <HandbookCard icon={<ShieldCheck className="size-5" />} title="Log proof" text="Proof Board is where the app becomes real. Add conversations, replies, waitlist signups, payment intent, or revenue. No OpenAI is used here." />
        <HandbookCard icon={<Radar className="size-5" />} title="Check Local Market Pulse" text="This is a local preview during beta. It uses saved project context only. External search providers and background monitoring are not enabled." />
        <HandbookCard icon={<Compass className="size-5" />} title="Review Launch Command Center" text="Use the checklist and launch readiness score to see whether this idea is ready for friends, testers, or more validation." />
      </section>

      <section className="rounded-[2rem] border border-gold/25 bg-gold/10 p-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-amber-700">
          <MessageCircle className="size-4" />
          What feedback should you send?
        </p>
        <ul className="mt-4 grid gap-3 text-sm font-medium leading-6 text-ink/75 md:grid-cols-2">
          {["What felt useful?", "What was confusing?", "What broke or looked weird?", "What felt overwhelming?", "What would make you come back?", "What would make this worth paying for?"].map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[.16em] text-moss">Beta expectations</p>
        <div className="mt-4 grid gap-3 text-sm font-medium leading-6 text-ink/75">
          <p>Some features are experimental, limited, or local previews. That is expected.</p>
          <p>OpenAI should only run after explicit generation clicks. Project pages, Proof Board, notes, checklists, exports, and Market Pulse preview should not spend AI credits on page load.</p>
          <p>Payments are not part of this beta test. Pricing is shown for product clarity, but checkout is intentionally paused unless the founder enables it later.</p>
        </div>
      </section>
    </div>
  );
}

function HandbookCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-card">
      <div className="grid size-11 place-items-center rounded-2xl bg-violet/10 text-violet">{icon}</div>
      <h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-ink/72">{text}</p>
    </article>
  );
}
