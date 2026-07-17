import { AlertTriangle, Bot, CheckCircle2, Gauge, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiRequest, AiRuntimeControl } from "@/lib/database.types";
import { AI_TASKS } from "@/lib/ai/platform/registry";

export const metadata = { title: "AI Operations" };
export const dynamic = "force-dynamic";

export default async function AiOperationsPage() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: requestData, error }, { data: controlData }] = await Promise.all([
    admin
      .from("ai_requests")
      .select("task_id,model_route,model_id,status,input_tokens,output_tokens,cached_input_tokens,actual_cost_usd,latency_ms,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2_500),
    admin.from("ai_runtime_controls").select("*").order("control_key"),
  ]);
  const requests = (requestData ?? []) as Pick<AiRequest, "task_id" | "model_route" | "model_id" | "status" | "input_tokens" | "output_tokens" | "cached_input_tokens" | "actual_cost_usd" | "latency_ms" | "created_at">[];
  const controls = (controlData ?? []) as AiRuntimeControl[];
  const providerCalls = requests.filter((row) => ["completed", "failed", "reconciliation_needed"].includes(row.status));
  const completed = requests.filter((row) => row.status === "completed");
  const cached = requests.filter((row) => row.status === "cached");
  const blocked = requests.filter((row) => row.status === "blocked");
  const needsReconciliation = requests.filter((row) => row.status === "reconciliation_needed");
  const totalCost = requests.reduce((sum, row) => sum + Number(row.actual_cost_usd ?? 0), 0);
  const p95Latency = percentile(providerCalls.map((row) => row.latency_ms ?? 0).filter(Boolean), 0.95);
  const byTask = Object.keys(AI_TASKS).map((taskId) => {
    const rows = requests.filter((row) => row.task_id === taskId);
    return {
      taskId,
      calls: rows.filter((row) => ["completed", "failed", "reconciliation_needed"].includes(row.status)).length,
      cache: rows.filter((row) => row.status === "cached").length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      cost: rows.reduce((sum, row) => sum + Number(row.actual_cost_usd ?? 0), 0),
    };
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet">
          <ShieldCheck className="size-4" />
          Server-only cost safety
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">AI operations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
          Safe 30-day aggregates from the financial ledger. Prompts, generated content, hashes, provider request IDs, and user identifiers are not shown.
        </p>
        {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-900">Ledger query failed. AI requests remain fail-closed.</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Bot className="size-5" />} label="Provider calls" value={providerCalls.length.toLocaleString()} />
        <Metric icon={<Gauge className="size-5" />} label="Recorded cost" value={money(totalCost)} detail="Actual usage only" />
        <Metric icon={<CheckCircle2 className="size-5" />} label="Cache hits" value={cached.length.toLocaleString()} detail={`${completed.length} completed`} />
        <Metric icon={<AlertTriangle className="size-5" />} label="Needs review" value={needsReconciliation.length.toLocaleString()} detail={`${blocked.length} blocked · p95 ${p95Latency}ms`} />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-card">
        <div className="border-b border-ink/10 p-6">
          <h2 className="font-display text-2xl font-semibold">Task usage</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-[.12em] text-ink/55">
              <tr><th className="p-4">Task</th><th className="p-4">Calls</th><th className="p-4">Cache</th><th className="p-4">Blocked</th><th className="p-4">Cost</th></tr>
            </thead>
            <tbody>
              {byTask.map((row) => (
                <tr key={row.taskId} className="border-t border-ink/10">
                  <td className="p-4 font-bold">{row.taskId}</td><td className="p-4">{row.calls}</td><td className="p-4">{row.cache}</td><td className="p-4">{row.blocked}</td><td className="p-4">{money(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card">
        <h2 className="font-display text-2xl font-semibold">Runtime controls</h2>
        <p className="mt-2 text-sm text-ink/60">Changes are intentionally performed through the audited operator runbook.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {controls.map((control) => (
            <div key={control.control_key} className="flex items-center justify-between rounded-2xl border border-ink/10 p-4">
              <div><p className="font-bold">{control.control_key}</p><p className="mt-1 text-xs text-ink/55">{control.note}</p></div>
              <span className={control.enabled ? "rounded-full bg-moss/10 px-3 py-1 text-xs font-black text-moss" : "rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-800"}>{control.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return <div className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-card"><div className="text-violet">{icon}</div><p className="mt-3 text-xs font-black uppercase tracking-[.14em] text-ink/55">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value}</p>{detail && <p className="mt-1 text-xs text-ink/50">{detail}</p>}</div>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function percentile(values: number[], value: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
}
