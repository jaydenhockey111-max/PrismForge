import { History } from "lucide-react";
import { FounderTimeline } from "@/components/founder-os/founder-timeline";
import { FormMessage } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import { loadFounderTimeline } from "@/lib/founder-os/timeline.server";

export const metadata = { title: "Founder Timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; before?: string }> }) {
  const [, params] = await Promise.all([requireProfile(), searchParams]);
  const timeline = await loadFounderTimeline({ query: params.q, category: params.category, before: params.before });
  return <div>
    <FormMessage message={timeline.error ?? undefined} />
    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet"><History className="size-4" />Founder memory</div>
    <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Your founder timeline.</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60 sm:text-base">A permanent record of what you learned, changed, proved, launched, and earned across every project. Quiet software activity is intentionally excluded.</p>
    <FounderTimeline {...timeline} referenceNow={new Date().toISOString()} />
  </div>;
}

