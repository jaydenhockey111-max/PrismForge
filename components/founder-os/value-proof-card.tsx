import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, ClipboardList, GitBranch, ShieldCheck } from "lucide-react";
import { CopySectionButton } from "@/components/founder-os/copy-section-button";
import type { ClarityFundamental, ValueProofReport, ValueProofTextItem } from "@/lib/founder-os/valueProof";

export function ValueProofCard({ projectId, valueProof }: { projectId: string; valueProof: ValueProofReport }) {
  const hasEvidence = valueProof.snapshot.evidenceCollected.length > 0 && valueProof.evidenceScore > 0;

  return (
    <section className="mt-6 rounded-[2rem] border border-violet/15 bg-gradient-to-br from-white via-violet/5 to-lime/20 p-6 shadow-card">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet">Value Proof</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">What PrismForge actually added.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
            A calm record of what became clearer, what you recorded from the real world, and what remains unproven.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${projectId}/value-proof`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-5 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
            View Value Proof
          </Link>
          <CopySectionButton text={valueProof.shareSummary} label="Copy summary" analyticsEventName="value_summary_copied" projectId={projectId} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ValueBox label="Starting point" value={valueProof.startingPoint ?? "Original starting inputs were not recorded for this legacy project."} />
        <ValueBox label="Current project" value={valueProof.structuredProject} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={<CheckCircle2 className="size-5" />} label="Fundamentals defined" value={`${valueProof.clarityDefinedCount}/${valueProof.clarityTotalCount}`} detail="Deterministic checklist, not a success prediction." />
        <SummaryTile icon={<ShieldCheck className="size-5" />} label="Evidence recorded" value={hasEvidence ? valueProof.evidenceItemCount : 0} detail="Only Proof Board evidence counts." />
        <SummaryTile icon={<ClipboardList className="size-5" />} label="Assumptions tracked" value={valueProof.snapshot.assumptionsIdentified.length} detail="Beliefs separated from proof." />
        <SummaryTile icon={<GitBranch className="size-5" />} label="Decisions captured" value={valueProof.snapshot.decisionsRecorded.length} detail="Derived from real project history." />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ValueItemList title="What became clearer" items={valueProof.snapshot.clarityGained.slice(0, 4)} empty="Your starting point is saved. PrismForge will show changes as the project evolves." />
        <ValueItemList title="PrismForge helped with" items={valueProof.snapshot.prismForgeContribution.slice(0, 4)} empty="Create a project to see structured contributions." />
        <ValueItemList title="You did" items={valueProof.snapshot.founderContribution.slice(0, 4)} empty="No external founder action recorded yet. Log proof after talking to users." />
      </div>
    </section>
  );
}

export function ValueFundamentals({ items }: { items: ClarityFundamental[] }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <h3 className="font-display text-2xl font-semibold text-ink">Project fundamentals</h3>
      <p className="mt-2 text-sm leading-6 text-ink/60">What is defined clearly enough to act on. This is not a market-validity score.</p>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-2xl bg-cream/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-ink">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink/60">{item.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${item.defined ? "bg-lime/40 text-moss" : "bg-white text-ink/45"}`}>
                {item.defined ? "Defined" : "Missing"}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink/45">Source: {item.source.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValueScoreBreakdown({ title, helper, items }: { title: string; helper: string; items: ValueProofReport["clarityBreakdown"] }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/60">{helper}</p>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-2xl bg-cream/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-ink">{item.label}</p>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet">{item.band}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink/55">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValueList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {items.length ? (
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
          {items.map((item) => <li key={item} className="rounded-2xl bg-cream/65 p-3">{item}</li>)}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-cream/65 p-3 text-sm leading-6 text-ink/55">{empty}</p>
      )}
    </div>
  );
}

export function ValueItemList({ title, items, empty }: { title: string; items: ValueProofTextItem[]; empty: string }) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-sm">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {items.length ? (
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
          {items.map((item) => (
            <li key={`${item.title}-${item.detail}`} className="rounded-2xl bg-cream/65 p-3">
              <p className="font-bold text-ink/75">{item.title}</p>
              <p className="mt-1">{item.detail}</p>
              <p className="mt-2 text-xs font-semibold text-ink/40">Source: {item.source.label}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-cream/65 p-3 text-sm leading-6 text-ink/55">{empty}</p>
      )}
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">{value}</p>
    </div>
  );
}

function SummaryTile({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{label}</p>
        <div className="grid size-10 place-items-center rounded-2xl bg-violet/10 text-violet">{icon}</div>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink/50">{detail}</p>
    </div>
  );
}
