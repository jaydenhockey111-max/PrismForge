import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Terms of use" };

export default function TermsPage() {
  return <main className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
    <p className="text-sm font-bold uppercase tracking-[.16em] text-violet">Effective June 24, 2026</p>
    <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight">Terms of use</h1>
    <p className="mt-6 text-lg leading-8 text-ink/65">These terms govern use of the {APP_NAME} MVP. By creating an account, you agree to use the service responsibly.</p>
    <div className="mt-10 grid gap-9 leading-7 text-ink/70">
      <section><h2 className="font-display text-2xl font-semibold text-ink">Informational service</h2><p className="mt-3">{APP_NAME} provides founder reports, market-style signals, planning tools, and gamified progress, not legal, tax, financial, educational, or professional advice. Scores and signals are estimates based on entered project data and available rules. They are not guarantees of revenue, funding, launch success, or accuracy.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Verify important decisions</h2><p className="mt-3">Market conditions, competitors, pricing, customer needs, and third-party links can change. You are responsible for independently verifying information before spending money, launching publicly, or making business decisions.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Accounts</h2><p className="mt-3">Provide accurate information, protect your password, and do not access another person's account. You are responsible for activity under your account. Users must be at least 13; minors should involve a parent or guardian where appropriate.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Acceptable use</h2><p className="mt-3">Do not misuse the service, probe its security, scrape it at unreasonable volume, upload malicious content, impersonate others, or use it to violate law or third-party rights. Access may be suspended to protect users or the service.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Subscriptions</h2><p className="mt-3">When payments are enabled, Premium subscriptions renew until canceled through the billing portal. Price, billing interval, and cancellation terms are shown before checkout. Deleting an account does not automatically cancel an external Stripe subscription unless the billing subscription has already been canceled. Test-mode transactions are not real purchases.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Availability and liability</h2><p className="mt-3">The MVP is provided on an "as available" basis and may change or experience interruptions. To the extent permitted by law, the operator is not responsible for losses caused by reliance on generated reports, market signals, third-party content, missed deadlines, gamification progress, or unavailable services.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Changes</h2><p className="mt-3">These terms may change as the MVP develops. Continued use after an updated effective date indicates acceptance of the revised terms.</p></section>
    </div>
  </main>;
}
