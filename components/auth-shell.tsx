import { Logo } from "@/components/logo";

export function AuthShell({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="paper-grid relative grid min-h-screen place-items-center px-5 py-14">
      <div className="w-full max-w-md">
        <div className="mb-9 flex justify-center"><Logo /></div>
        <section className="rounded-[1.5rem] border border-ink/10 bg-white p-7 shadow-card sm:p-9">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.035em]">{title}</h1>
          <p className="mt-4 leading-7 text-ink/60">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 border-t border-ink/10 pt-5 text-center text-xs font-medium leading-5 text-ink/45">
            Google sign-in depends on Supabase/Google OAuth settings. Email sign-in remains the reliable beta fallback.
          </p>
        </section>
        <div className="mt-6 text-center text-sm text-ink/60">{footer}</div>
      </div>
    </main>
  );
}
