import Link from "next/link";
import { ArrowLeft, HelpCircle, Mail, Sparkles } from "lucide-react";

export const metadata = { title: "FAQ" };

const SUPPORT_EMAIL = "jayden.hockey111@gmail.com";
const SUPPORT_SUBJECT = "PrismForge beta support request";
const SUPPORT_BODY = "Please describe what happened, what page you were on, and what you expected.";

const faqs = [
  {
    question: "What is PrismForge actually for?",
    answer: "PrismForge helps first-time founders stop guessing and start proving. The goal is to turn one idea into a validation plan, outreach scripts, a proof tracker, and a clear next action.",
  },
  {
    question: "What should I do first?",
    answer: "Create one project, read its Biggest Question and Next Best Action, run one small test with real people, then log what happened in Proof Board.",
  },
  {
    question: "What is a project?",
    answer: "A project is one business idea workspace. It keeps the report, biggest question, next action, proof experiments, decisions, notes, launch checklist, and meaningful history together.",
  },
  {
    question: "Does opening a project spend OpenAI credits?",
    answer: "No. Project pages, Proof Board, notes, checklists, exports, and Review should not call OpenAI on page load. AI credits are only used after explicit generation clicks on approved features.",
  },
  {
    question: "Why do some AI buttons show cached or cooldown states?",
    answer: "That is intentional beta cost control. PrismForge saves generated outputs, uses cached results when possible, asks before regenerating, and enforces cooldowns so one button cannot accidentally burn credits repeatedly.",
  },
  {
    question: "What is Proof Board?",
    answer: "Proof Board is where you log real-world evidence: people contacted, replies, pain confirmed, interested users, waitlist signups, payment intent, revenue, quotes, learnings, and next actions.",
  },
  {
    question: "What should I log if I have no users yet?",
    answer: "Start with a tiny validation experiment: contact 10 people in your target audience and ask about the pain point before building more features. Planned experiments can start with zero metrics.",
  },
  {
    question: "What is Review?",
    answer: "Review connects recorded evidence, decisions, meaningful history, and reusable learning from earlier projects. It avoids activity scores so the next recommendation stays grounded in outcomes.",
  },
  {
    question: "Can I pay for PrismForge yet?",
    answer: "Payments are intentionally paused for beta. Pricing exists to clarify future plans, but Stripe checkout should not charge beta testers right now.",
  },
  {
    question: "Where do I change my profile, email preferences, or export data?",
    answer: "Use Settings. Profile, email preferences, data export, support links, and account deletion are consolidated there to avoid duplicate pages.",
  },
  {
    question: "Who has admin access?",
    answer: "Only jayden.hockey111@gmail.com should have admin access. Founder beta feature access does not mean admin access.",
  },
  {
    question: "What feedback is most helpful?",
    answer: "Tell us what felt useful, confusing, broken, overwhelming, missing, or not worth paying for. Screenshots and the page/project where it happened are extra helpful.",
  },
] as const;

export default function FaqPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${encodeURIComponent(SUPPORT_BODY)}`;

  return (
    <div className="max-w-5xl">
      <Link href="/help" className="inline-flex items-center gap-2 text-sm font-bold text-ink/55 hover:text-ink">
        <ArrowLeft className="size-4" />
        Back to Help
      </Link>

      <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card">
        <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
          <HelpCircle className="size-4" />
          FAQ
        </p>
        <h1 className="page-title mt-3">Quick answers for beta testers.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
          If you are not sure where to click, remember the loop: create a project, get one next action, contact real people, log proof, and repeat.
        </p>
      </section>

      <section className="mt-8 grid gap-4">
        {faqs.map((faq, index) => (
          <details key={faq.question} className="group rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm open:shadow-card">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <span>
                <span className="text-xs font-black uppercase tracking-[.14em] text-violet">Question {index + 1}</span>
                <span className="mt-2 block font-display text-2xl font-semibold text-ink">{faq.question}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-lg font-black text-ink transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/65">{faq.answer}</p>
          </details>
        ))}
      </section>

      <section className="mt-8 rounded-[2rem] border border-gold/25 bg-gold/10 p-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-amber-700">
          <Sparkles className="size-4" />
          Still stuck?
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
          Email support with what happened, what page you were on, and what you expected. Beta weirdness is normal; hidden weirdness is the enemy.
        </p>
        <a href={mailto} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet hover:shadow-md">
          <Mail className="size-4" />
          Email support
        </a>
      </section>
    </div>
  );
}
