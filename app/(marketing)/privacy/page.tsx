import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return <main className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
    <p className="text-sm font-bold uppercase tracking-[.16em] text-violet">Effective June 24, 2026</p>
    <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight">Privacy policy</h1>
    <p className="mt-6 text-lg leading-8 text-ink/65">{APP_NAME} uses the information you provide to generate founder reports, personalize project guidance, and surface Market Pulse signals. This policy explains the MVP&apos;s current data practices.</p>
    <div className="mt-10 grid gap-9 leading-7 text-ink/70">
      <section><h2 className="font-display text-2xl font-semibold text-ink">Information we collect</h2><p className="mt-3">We collect account information such as email and name, plus profile details you choose to provide: age, state, income range, student status, occupation, interests, goals, education level, resume link, and email-alert preference. Stripe processes payment information directly when payments are enabled; {APP_NAME} does not store complete card numbers.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">How we use it</h2><p className="mt-3">We use profile information to calculate founder-fit scores, display project recommendations, power gamification progress, secure your account, administer subscriptions, send requested alerts, prevent abuse, and improve reliability. We do not sell personal information.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Service providers</h2><p className="mt-3">The MVP uses Supabase for authentication and database hosting, Vercel for application hosting, Stripe for subscription billing when enabled, and Resend for transactional email. Market Pulse currently uses project data and local deterministic signals unless a future server-side provider is explicitly enabled.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Retention and security</h2><p className="mt-3">Information is retained while your account is active or as needed to operate and protect the service. Access is restricted using database row-level security and server-only credentials. No internet service can guarantee absolute security.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Your choices</h2><p className="mt-3">You may update profile information, disable email alerts from the Profile page, export your data, or delete your account from the Account page. If you have a paid subscription, cancel billing first so Stripe does not continue charging after deletion.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Cookies</h2><p className="mt-3">The app uses essential authentication cookies through Supabase so you can stay signed in securely. We do not use advertising cookies in this MVP.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Children</h2><p className="mt-3">{APP_NAME} is not intended for children under 13. Users under the age of legal majority should review subscription purchases and sensitive profile information with a parent or guardian.</p></section>
      <section><h2 className="font-display text-2xl font-semibold text-ink">Changes</h2><p className="mt-3">This policy may change as the service develops. Material changes will be reflected by a new effective date on this page.</p></section>
    </div>
  </main>;
}
