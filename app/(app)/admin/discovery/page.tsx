import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Discovery disabled" };

export default function DiscoveryReviewPage() {
  return (
    <div>
      <section className="mt-5 rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-moss">
          <Search className="size-4" />
          Discovery disabled
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">External discovery is off.</h1>
        <p className="mt-3 max-w-3xl text-ink/60">
          PrismForge beta focuses on saved projects, validation evidence, and local project intelligence. This queue is intentionally not exposed.
        </p>
        <ButtonLink href="/admin" variant="secondary" className="mt-6">Back to admin</ButtonLink>
      </section>
    </div>
  );
}
