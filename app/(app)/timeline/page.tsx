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
    <div className="eyebrow flex items-center gap-2"><History className="size-4" />Founder memory</div>
    <h1 className="page-title mt-3">Your founder timeline.</h1>
    <p className="page-intro mt-4">A permanent record of what you learned, changed, proved, launched, and earned across every project. Quiet software activity is intentionally excluded.</p>
    <FounderTimeline {...timeline} referenceNow={new Date().toISOString()} />
  </div>;
}

