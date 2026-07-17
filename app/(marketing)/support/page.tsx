import { Mail, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Support" };

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const hasPublicSupportEmail = supportEmail.length > 3 && !supportEmail.includes("REPLACE_WITH_DOMAIN");

export default function SupportPage() {
  return <main className="mx-auto max-w-3xl px-5 py-20">
    <section className="rounded-[2rem] border border-ink/10 bg-white p-8 shadow-card">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-violet"><Mail className="size-4" />Support</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Need help with {APP_NAME}?</h1>
      <p className="mt-4 leading-7 text-ink/65">Email us for account help, privacy requests, confusing project guidance, billing questions, or safety concerns.</p>
      {hasPublicSupportEmail ? (
        <a className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-moss" href={`mailto:${supportEmail}`}>{supportEmail}</a>
      ) : (
        <p className="mt-6 rounded-2xl bg-cream p-4 text-sm font-semibold text-ink/65">Private beta support is currently handled through the Beta Feedback form inside the app.</p>
      )}
    </section>
    <section className="mt-6 rounded-[2rem] border border-ink/10 bg-cream p-6">
      <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-moss" />Important note</p>
      <p className="mt-2 text-sm leading-6 text-ink/60">{APP_NAME} helps founders generate reports, organize projects, monitor market-style signals, and prepare private-alpha launches. We do not guarantee business outcomes, revenue, funding, investor interest, or user growth.</p>
      <ButtonLink href="/privacy" variant="secondary" className="mt-5">Read privacy policy</ButtonLink>
    </section>
  </main>;
}
