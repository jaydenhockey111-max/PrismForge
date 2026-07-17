import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { BetaFeedbackButton } from "@/components/beta-feedback-button";
import { ProjectSwitcher } from "@/components/founder-os/project-switcher";
import { Logo } from "@/components/logo";
import { logout } from "@/app/(auth)/actions";
import { requireProfile } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { getEntitlements } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: xp }, { data: focus }, { data: activeProjects }] = await Promise.all([
    supabase.from("user_xp").select("premium_trial_until").eq("user_id", profile.id).maybeSingle(),
    supabase.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(),
    supabase.from("opportunity_projects").select("id,title").eq("user_id", profile.id).eq("lifecycle_status", "active").is("deleted_at", null).order("last_meaningful_activity_at", { ascending: false }).limit(6),
  ]);
  const switcherProjects = [...(activeProjects ?? [])];
  if (focus?.project_id && !switcherProjects.some((project) => project.id === focus.project_id)) {
    const { data: focusedProject } = await supabase.from("opportunity_projects").select("id,title").eq("id",focus.project_id).eq("user_id",profile.id).eq("lifecycle_status","active").is("deleted_at",null).maybeSingle();
    if (focusedProject) switcherProjects.unshift(focusedProject);
  }
  const entitlements = getEntitlements(profile, xp);
  const hasAdminAccess = canAccessAdmin(profile);
  const planLabel = entitlements.reason === "lifetime_founder" ? "Lifetime Founder" : entitlements.reason === "beta_founder" ? "Founder beta" : entitlements.reason === "trial" ? "Trial" : entitlements.effectivePlan;

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="border-b border-ink/10 bg-white/90 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex min-h-20 items-center justify-between px-5 lg:px-6">
          <Logo />
          <span className="rounded-full border border-ink/10 bg-cream px-2.5 py-1 text-[.625rem] font-bold uppercase tracking-[.1em] text-ink/55">{planLabel}</span>
        </div>
        <div className="hidden px-4 lg:block">
          <ProjectSwitcher projects={switcherProjects} currentProjectId={focus?.project_id ?? null} />
        </div>
        <div className="hidden flex-1 overflow-y-auto px-4 py-7 lg:block">
          <AppNavigation admin={hasAdminAccess} />
        </div>
        <div className="hidden border-t border-ink/10 p-4 lg:block">
          <Link href="/account" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink/[.045]">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink/[.06] text-ink/60"><UserRound className="size-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{profile.name ?? "Founder"}</span>
              <span className="block truncate text-xs text-ink/45">{profile.email}</span>
            </span>
          </Link>
          <div className="mt-2 flex items-center justify-between px-3">
            <Link href="/beta-guide" className="text-xs font-semibold text-ink/50 hover:text-violet">Beta guide</Link>
            <form action={logout}>
              <button aria-label="Sign out" className="grid size-8 place-items-center rounded-lg text-ink/45 hover:bg-ink/[.05] hover:text-ink"><LogOut className="size-4" /></button>
            </form>
          </div>
          <div className="mt-3 flex gap-3 border-t border-ink/10 px-3 pt-3 text-[.6875rem] text-ink/40">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </div>
        </div>
        <div className="border-t border-ink/10 px-5 py-3 lg:hidden">
          <ProjectSwitcher projects={switcherProjects} currentProjectId={focus?.project_id ?? null} />
          <div className="mt-3"><AppNavigation admin={hasAdminAccess} mobile /></div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="hidden min-h-16 items-center justify-between border-b border-ink/10 bg-white/55 px-8 backdrop-blur-xl lg:flex">
          <p className="text-sm font-medium text-ink/45">Make one decision. Test it in the real world.</p>
          <BetaFeedbackButton />
        </header>
        <div className="border-b border-ink/10 bg-white/55 px-5 py-3 backdrop-blur lg:hidden"><BetaFeedbackButton /></div>
        <main className="mx-auto max-w-[90rem] px-5 py-9 lg:px-10 lg:py-14 xl:px-14">{children}</main>
      </div>
    </div>
  );
}
