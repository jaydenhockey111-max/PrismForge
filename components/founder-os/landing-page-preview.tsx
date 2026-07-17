import type { LandingPageCopy } from "@/lib/founder-os/types";

export function LandingPagePreview({ copy }: { copy: LandingPageCopy }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white">
      <div className="aurora-card p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet">Landing page draft</p>
        <h3 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight">{copy.heroHeadline}</h3>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-ink/65">{copy.subheadline}</p>
        <button type="button" className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{copy.cta}</button>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {copy.benefitBullets.map((benefit) => (
          <div key={benefit} className="rounded-2xl border border-ink/10 bg-cream/50 p-4 text-sm font-semibold leading-6">{benefit}</div>
        ))}
      </div>
      <div className="border-t border-ink/10 p-6">
        <p className="rounded-2xl bg-ink/5 p-4 text-sm italic text-ink/60">{copy.socialProofPlaceholder}</p>
        <div className="mt-5 grid gap-3">
          {copy.faq.map((item) => (
            <details key={item.question} className="rounded-2xl border border-ink/10 p-4">
              <summary className="cursor-pointer font-bold">{item.question}</summary>
              <p className="mt-2 text-sm leading-6 text-ink/60">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
