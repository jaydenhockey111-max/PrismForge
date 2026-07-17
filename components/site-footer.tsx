import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Logo />
        <nav className="flex flex-wrap gap-5 text-sm font-semibold text-ink/55" aria-label="Legal">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/support" className="hover:text-ink">Support</Link>
          <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
        </nav>
        <p className="text-xs text-ink/45">© {new Date().getFullYear()} {APP_NAME}</p>
      </div>
    </footer>
  );
}
