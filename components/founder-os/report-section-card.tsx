import { cn } from "@/lib/utils";

export function ReportSectionCard({
  kicker,
  title,
  children,
  className,
}: {
  kicker?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-card", className)}>
      {kicker && <p className="text-xs font-black uppercase tracking-[.16em] text-violet">{kicker}</p>}
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
