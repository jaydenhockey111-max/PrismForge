import { FlaskConical, MessageCircle } from "lucide-react";
import { BetaFeedbackButton } from "@/components/beta-feedback-button";

export function BetaNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`dopamine-card overflow-hidden rounded-[1.5rem] border border-violet/15 bg-white/80 shadow-sm backdrop-blur ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet/10 text-violet">
            <FlaskConical className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-violet">PrismForge beta</p>
            <p className="mt-1 text-sm font-medium leading-6 text-ink/72">
              Some features are experimental, limited, or local previews. Please share feedback so PrismForge gets sharper.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MessageCircle className="hidden size-4 text-violet/60 sm:block" />
          <BetaFeedbackButton />
        </div>
      </div>
    </section>
  );
}
