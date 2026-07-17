import { BookOpen, HelpCircle, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Help" };

const SUPPORT_EMAIL = "jayden.hockey111@gmail.com";
const SUPPORT_SUBJECT = "PrismForge beta support request";
const SUPPORT_BODY = "Hi Jayden,%0D%0A%0D%0AI need help with PrismForge.%0D%0A%0D%0AWhat happened:%0D%0A%0D%0APage or project:%0D%0A%0D%0A";

export default function HelpPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${SUPPORT_BODY}`;

  return (
    <div className="max-w-5xl">
      <section className="flex flex-col justify-between gap-7 border-b border-ink/10 pb-9 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <HelpCircle className="size-4" />
            Help
          </p>
          <h1 className="page-title mt-3">Help, FAQ, and beta support.</h1>
          <p className="page-intro mt-4">
            PrismForge is in beta. If something feels confusing, broken, overwhelming, or not useful yet, this is the place to start.
          </p>
        </div>
        <a href={mailto} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet/80 bg-violet px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#5649d7]">
          <Mail className="size-4" />
          Email support
        </a>
      </section>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <HelpCard icon={<MessageSquareText className="size-5" />} title="Beta feedback" description="Use the feedback button for quick ratings and notes while testing." href="/dashboard" action="Open dashboard" />
        <HelpCard icon={<BookOpen className="size-5" />} title="FAQ" description="Get quick answers about projects, AI credits, Proof Board, Market Pulse, payments, and beta limits." href="/help/faq" action="Read FAQ" />
        <HelpCard icon={<ShieldCheck className="size-5" />} title="Account controls" description="Export your data, manage email digests, or request deletion from Settings." href="/settings" action="Open settings" />
        <HelpCard icon={<HelpCircle className="size-5" />} title="Testing guide" description="Read the private-alpha handbook and suggested test flow." href="/beta-guide" action="Read guide" />
      </div>
    </div>
  );
}

function HelpCard({ icon, title, description, href, action }: { icon: React.ReactNode; title: string; description: string; href: string; action: string }) {
  return (
    <section className="surface-flat p-6">
      <div className="grid size-11 place-items-center rounded-xl bg-violet/10 text-violet">{icon}</div>
      <h2 className="mt-4 font-display text-xl font-semibold tracking-[-.02em] text-ink">{title}</h2>
      <p className="mt-2 min-h-20 text-sm leading-6 text-ink/60">{description}</p>
      <ButtonLink href={href} variant="secondary" className="mt-5">{action}</ButtonLink>
    </section>
  );
}
