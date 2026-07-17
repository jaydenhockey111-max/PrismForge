import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/admin";
import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

export async function SiteHeader() {
  const profile = await getCurrentProfile();
  return (
    <header className="border-b border-ink/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-ink/5 md:block" href="/support">Support</Link>
          {profile ? (
            <>
              <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-ink/5 sm:block" href="/dashboard">Dashboard</Link>
              {canAccessAdmin(profile) && <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-ink/5 sm:block" href="/admin">Admin</Link>}
              <form action={logout}><button className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-ink/40">Sign out</button></form>
            </>
          ) : (
            <><ButtonLink href="/sign-in" variant="ghost" className="hidden sm:inline-flex">Sign in</ButtonLink><ButtonLink href="/start" className="bg-violet px-4 hover:bg-ink sm:px-5">Start Creating</ButtonLink></>
          )}
        </nav>
      </div>
    </header>
  );
}
