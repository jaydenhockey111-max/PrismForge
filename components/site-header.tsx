import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/admin";
import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

export async function SiteHeader() {
  const profile = await getCurrentProfile();
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-5 px-5 lg:px-8">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <Link className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink md:block" href="/support">Support</Link>
          {profile ? (
            <>
              <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink" href="/dashboard">Dashboard</Link>
              {canAccessAdmin(profile) && <Link className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink sm:block" href="/admin">Admin</Link>}
              <form action={logout} className="hidden sm:block"><button className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-ink/30">Sign out</button></form>
            </>
          ) : (
            <><ButtonLink href="/sign-in" variant="ghost" className="hidden sm:inline-flex">Sign in</ButtonLink><ButtonLink href="/start" className="px-4 sm:px-5">Start a project</ButtonLink></>
          )}
        </nav>
      </div>
    </header>
  );
}
