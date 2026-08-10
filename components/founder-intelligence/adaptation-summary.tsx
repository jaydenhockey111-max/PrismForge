import Link from "next/link";
import { BrainCircuit, Info, SlidersHorizontal } from "lucide-react";
import type { FounderIntelligenceProfile } from "@/lib/founder-intelligence/types";

export function AdaptationSummary({ profile, source }: { profile: FounderIntelligenceProfile; source: "cache" | "recalculated" | "fallback" }) {
  const experience = profile.verifiedExperience;
  return (
    <section className="mt-8 rounded-[2rem] border border-violet/15 bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet"><BrainCircuit className="size-4" />How PrismForge is adapting</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Your choices lead. Verified history adds context.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60">This is not a personality score. A new project still has to earn its own evidence.</p>
        </div>
        <Link href="/settings" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-cream px-5 text-sm font-black text-ink transition hover:bg-white"><SlidersHorizontal className="size-4" />Change guidance</Link>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Guidance Style" value={label(profile.explicitPreferences.guidanceMode)} />
        <Stat label="Explanation Detail" value={label(profile.explicitPreferences.explanationDepth)} />
        <Stat label="Action Pace" value={label(profile.explicitPreferences.questIntensity)} />
        <Stat label="Eligible History" value={`${experience.eligibleProjectCount} project${experience.eligibleProjectCount === 1 ? "" : "s"}`} />
      </div>
      <details className="mt-5 rounded-2xl border border-ink/10 bg-cream/45 p-4 text-sm text-ink/65">
        <summary className="cursor-pointer font-black text-ink">Why these recommendations?</summary>
        <ul className="mt-3 grid gap-2 leading-6">{profile.adaptationState.reasons.map((reason) => <li key={reason} className="flex gap-2"><Info className="mt-1 size-4 shrink-0 text-violet" />{reason}</li>)}</ul>
        <p className="mt-3 text-xs text-ink/45">Profile source: {source}. Updated {new Date(profile.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.</p>
      </details>
    </section>
  );
}

function Stat({ label: title, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-ink/10 bg-cream/45 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-ink/45">{title}</p><p className="mt-2 text-lg font-black text-ink">{value}</p></div>; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

