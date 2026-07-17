"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, ListChecks, Target } from "lucide-react";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import { getFirstDollarDecision, getFirstDollarStage, getRevenueSignal } from "@/lib/founder-os/firstDollarSprint";
import type { OpportunityReport } from "@/lib/founder-os/types";
import type { ProofSummary } from "@/lib/proof-board";

export function FirstDollarSprint({
  projectTitle,
  report,
  proof,
}: {
  projectTitle: string;
  report: OpportunityReport;
  proof: ProofSummary;
}) {
  const [liveProof, setLiveProof] = useState(proof);
  const target = report.summary.targetCustomer || "your target customer";
  const pain = report.summary.painPoint || "this pain point";
  const price = report.monetizationPlan.suggestedPrice || "$10";
  const offer = `I'm testing a simple version of ${projectTitle}. If I could help you with ${pain}, would you pay ${price} or join a beta?`;
  const decision = useMemo(() => getFirstDollarDecision(liveProof), [liveProof]);
  const signal = useMemo(() => getRevenueSignal(liveProof), [liveProof]);
  const stage = useMemo(() => getFirstDollarStage(liveProof), [liveProof]);

  useEffect(() => {
    function onProofSummaryUpdated(event: Event) {
      const custom = event as CustomEvent<{ summary?: ProofSummary }>;
      if (custom.detail?.summary) setLiveProof(custom.detail.summary);
    }
    window.addEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);
    return () => window.removeEventListener("prismforge:proof-summary-updated", onProofSummaryUpdated);
  }, []);
  const sprintText = [
    "PrismForge First Dollar Sprint",
    "",
    `Project: ${projectTitle}`,
    `Target: ${target}`,
    `Offer: ${offer}`,
    "",
    "Workflow:",
    "1. Define smallest offer",
    "2. Choose 10 people to ask",
    "3. Send the offer",
    "4. Track response in Proof Board",
    "5. Decide whether to build, pivot, or kill",
    "",
    `Current signal: ${signal.label}`,
    `Stage: ${stage.stage}`,
    `Missing evidence: ${stage.missing}`,
    `Next payment test: ${stage.nextPaymentTest}`,
    `Decision: ${decision}`,
  ].join("\n");

  return (
    <section id="first-dollar-sprint" className="mt-8 rounded-[2rem] border border-gold/25 bg-gradient-to-br from-white via-gold/10 to-lime/20 p-6 shadow-card">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-amber-700">
            <DollarSign className="size-4" />
            First Dollar Sprint
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Try to get a payment signal before overbuilding.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
            No Stripe, no checkout, no fake revenue claims. This is a local action plan for testing willingness to pay, then logging the result in Proof Board.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.12em] ${signal.className}`}>{signal.label}</span>
          <CopySectionButton text={sprintText} label="Copy sprint" />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
        <article className="rounded-[1.75rem] border border-ink/10 bg-white p-5">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-moss">
            <Target className="size-4" />
            Smallest offer
          </p>
          <p className="mt-4 rounded-2xl bg-cream/70 p-4 text-sm font-semibold leading-6 text-ink/75">{offer}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopySectionButton text={offer} label="Copy offer" />
            <a href="?section=validate#proof-board" className="inline-flex min-h-10 items-center justify-center rounded-full bg-ink px-4 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet hover:shadow-md">Log results in Proof Board</a>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-ink/10 bg-white p-5">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet">
            <ListChecks className="size-4" />
            5-step workflow
          </p>
          <ol className="mt-4 grid gap-3">
            {["Define the smallest offer", "Choose 10 people to ask", "Send the offer", "Track response in Proof Board", "Decide whether to build, pivot, or kill"].map((step, index) => (
              <li key={step} className="flex gap-3 rounded-2xl bg-cream/60 p-3 text-sm font-semibold leading-6 text-ink/70">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-black text-white">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Proof-driven revenue stage</p>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-ink/70 md:grid-cols-3">
          <p className="rounded-2xl bg-cream/60 p-4"><span className="block font-black text-ink">Stage</span>{stage.stage}</p>
          <p className="rounded-2xl bg-cream/60 p-4"><span className="block font-black text-ink">Missing evidence</span>{stage.missing}</p>
          <p className="rounded-2xl bg-cream/60 p-4"><span className="block font-black text-ink">Next payment test</span>{stage.nextPaymentTest}</p>
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-violet">Current decision logic</p>
        <p className="mt-2 text-sm font-bold leading-6 text-ink/75">{decision}</p>
      </div>
    </section>
  );
}
