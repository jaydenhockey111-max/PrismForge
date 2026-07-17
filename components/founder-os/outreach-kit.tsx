import { MessageCircle, Send, Sparkles } from "lucide-react";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import { cleanGeneratedCopy, lowerFirst, readableProjectName, safePhrase, sentence } from "@/lib/founder-os/copyQuality";
import type { OpportunityReport } from "@/lib/founder-os/types";

export function OutreachKit({ projectId, projectTitle, report }: { projectId: string; projectTitle: string; report: OpportunityReport }) {
  const readableTitle = readableProjectName(projectTitle || report.summary.title, {
    audience: report.summary.targetCustomer,
    painPoint: report.summary.painPoint,
    businessType: report.input.businessType,
    interests: report.input.interests,
    existingIdea: report.input.existingIdea,
  });
  const target = safePhrase(report.summary.targetCustomer, "your target customer").toLowerCase();
  const pain = safePhrase(report.summary.painPoint, "the problem they are trying to solve");
  const benefit = safePhrase(report.summary.oneSentenceIdea, `${readableTitle} helps ${target} make progress on ${lowerFirst(pain)}`);
  const shortHook = cleanGeneratedCopy(report.contentPlan.shortFormHooks[0] ?? benefit);
  const messages = buildOutreachMessages(readableTitle, target, pain, benefit);
  const allText = [
    "PrismForge Outreach Kit",
    "",
    "Cold DMs",
    ...messages.coldDms.map((message, index) => `${index + 1}. ${message}`),
    "",
    "Interview Questions",
    ...messages.interviewQuestions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "Follow-ups",
    ...messages.followUps.map((message, index) => `${index + 1}. ${message}`),
    "",
    `Beta Invite: ${messages.betaInvite}`,
    "",
    `Waitlist Post: ${messages.waitlistPost}`,
    "",
    `Payment Intent Question: ${messages.paymentIntentQuestion}`,
    "",
    `Feedback Request: ${messages.feedbackRequest}`,
  ].join("\n");

  return (
    <section id="outreach-kit" className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <Send className="size-4" />
            Outreach Kit
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Copy-ready messages to validate with real people.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
            Use these messages outside the app, then log what happened in Proof Board. These are local templates, so opening this section does not spend AI credits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-lime/30 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-moss">Local fallback</span>
          <CopySectionButton text={allText} label="Copy full kit" analyticsEventName="outreach_copy_copied" projectId={projectId} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <ActionBlock
          title="5 cold DM scripts"
          kicker="Start conversations"
          items={messages.coldDms}
          accent="violet"
        />
        <ActionBlock
          title="5 customer interview questions"
          kicker="Learn, do not pitch"
          items={messages.interviewQuestions}
          accent="moss"
        />
        <ActionBlock
          title="3 follow-up messages"
          kicker="Turn silence into signal"
          items={messages.followUps}
          accent="gold"
        />
        <div className="grid gap-4">
          <CopyCard title="Beta invite message" text={messages.betaInvite} />
          <CopyCard title="Waitlist post" text={messages.waitlistPost} />
          <CopyCard title="Payment-intent question" text={messages.paymentIntentQuestion} />
          <CopyCard title="Feedback request" text={messages.feedbackRequest} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-violet/15 bg-violet/10 p-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-violet">
          <Sparkles className="size-4" />
          Suggested opening angle
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">{shortHook}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#proof-board" className="inline-flex min-h-10 items-center justify-center rounded-full bg-ink px-4 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet hover:shadow-md">Open Proof Board</a>
          <a href="#proof-board" className="inline-flex min-h-10 items-center justify-center rounded-full border border-violet/20 bg-white px-4 text-xs font-bold text-violet transition hover:-translate-y-0.5 hover:border-violet hover:shadow-md">Log validation result</a>
        </div>
      </div>
    </section>
  );
}

function ActionBlock({ title, kicker, items, accent }: { title: string; kicker: string; items: string[]; accent: "violet" | "moss" | "gold" }) {
  const colors = {
    violet: "text-violet bg-violet/10",
    moss: "text-moss bg-lime/30",
    gold: "text-amber-700 bg-gold/20",
  };
  return (
    <article className="rounded-[1.75rem] border border-ink/10 bg-cream/45 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.12em] ${colors[accent]}`}>{kicker}</p>
          <h3 className="mt-3 font-display text-2xl font-semibold text-ink">{title}</h3>
        </div>
        <CopySectionButton text={items.map((item, index) => `${index + 1}. ${item}`).join("\n\n")} label="Copy" analyticsEventName="outreach_copy_copied" />
      </div>
      <ol className="mt-5 grid gap-3 text-sm leading-6 text-ink/68">
        {items.map((item) => <li key={item} className="rounded-2xl bg-white p-4">{item}</li>)}
      </ol>
    </article>
  );
}

function CopyCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[1.25rem] border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-black text-ink"><MessageCircle className="size-4 text-violet" />{title}</p>
        <CopySectionButton text={text} label="Copy" analyticsEventName="outreach_copy_copied" />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/65">{text}</p>
    </article>
  );
}

function buildOutreachMessages(projectName: string, target: string, pain: string, benefit: string) {
  const painLower = lowerFirst(pain);
  const benefitSentence = sentence(benefit);

  return {
    coldDms: [
      `Quick question: when ${painLower} comes up, how do you handle it today?`,
      `I'm researching how ${target} handle ${painLower}. Could I ask you 2 quick questions? No pitch - just trying to learn.`,
      `I'm exploring ${projectName}, an early idea around ${painLower}. Would you be open to telling me what feels useful or missing?`,
      `If someone made ${painLower} easier this week, would that actually matter to you? I'm validating before I build too much.`,
      `Do you know anyone who struggles with ${painLower}? I'm looking for a few honest conversations before building.`,
    ].map(cleanGeneratedCopy),
    interviewQuestions: [
      `When was the last time you experienced ${pain}?`,
      "What did you try first, and why did it not fully work?",
      "How painful is this on a scale of 1-10?",
      "What would make you switch from your current workaround?",
      "If this existed today, would you join a beta, waitlist, or pay for early access?",
    ].map(cleanGeneratedCopy),
    followUps: [
      "Thanks - that helps. If I send a simple beta/waitlist page, would you be willing to take a look?",
      "One follow-up: what would make this valuable enough that you would actually use it weekly?",
      "Would you mind if I quote your feedback anonymously while I improve the idea?",
    ].map(cleanGeneratedCopy),
    betaInvite: cleanGeneratedCopy(`Hey - I'm testing an early version of ${projectName}. It helps ${target} make progress on ${painLower}. I'd love for you to try it and tell me what's confusing, useful, or broken.`),
    waitlistPost: cleanGeneratedCopy(`I'm validating ${projectName}. ${benefitSentence} If you're in this audience and the problem feels familiar, reply "beta" and I'll send early access when it's ready.`),
    paymentIntentQuestion: cleanGeneratedCopy(`If ${projectName} solved this specific problem for you, would you pay for a small beta or preorder? If yes, what price would feel reasonable?`),
    feedbackRequest: cleanGeneratedCopy(`Could you give blunt feedback on this early ${projectName} concept? I'm looking for what feels useful, confusing, broken, missing, or not worth paying for.`),
  };
}
