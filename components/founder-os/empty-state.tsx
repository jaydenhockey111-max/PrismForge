import { Lightbulb } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-ink/20 bg-white/70 p-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold/70">
        <Lightbulb />
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl leading-7 text-ink/60">{description}</p>
      {href && action && <ButtonLink href={href} className="mt-6 bg-gold text-ink shadow-md hover:bg-white focus-visible:ring-gold">{action}</ButtonLink>}
    </div>
  );
}
