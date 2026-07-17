import { Activity, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";

export const metadata = { title: "Admin Workspace" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const params = await searchParams;

  return (
    <div>
      <FormMessage message={params.message} type="success" />
      <FormMessage message={params.error} />

      <section className="mt-5 rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-moss">
          <ShieldCheck className="size-4" />
          Owner workspace
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">PrismForge Admin Workspace</h1>
        <p className="mt-3 max-w-3xl text-ink/60">
          Legacy resource management is disabled. PrismForge beta admin now focuses on monitoring, auth health, usage logs, and safe system operations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/admin/monitoring" variant="secondary" className="gap-2">
            <Activity className="size-4" />
            Monitoring
          </ButtonLink>
        </div>
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <span className="font-bold">Cost-control note:</span> External discovery controls are intentionally not exposed. Market Pulse remains local-only during beta.
      </section>
    </div>
  );
}
