import { Logo } from "@/components/logo";

export function AuthShell({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="paper-grid relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute left-8 top-10 size-40 rounded-full bg-gold/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-8 size-52 rounded-full bg-violet/20 blur-3xl" />
      <div className="w-full max-w-md animate-reward-pop">
        <div className="mb-8 text-center"><Logo /></div>
        <section className="aurora-card dopamine-card rounded-[2rem] border border-ink/10 p-7 shadow-glow sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-violet">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 leading-7 text-ink/60">{description}</p>
          <div className="mt-7">{children}</div>
          <p className="mt-5 rounded-2xl bg-white/65 p-3 text-center text-xs font-semibold leading-5 text-ink/50">
            Google sign-in depends on Supabase/Google OAuth settings. Email sign-in remains the reliable beta fallback.
          </p>
        </section>
        <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>
      </div>
    </main>
  );
}
