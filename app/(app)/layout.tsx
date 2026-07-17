import Link from "next/link";
import { Bell, FolderKanban, Gamepad2, HelpCircle, History, LayoutDashboard, Rocket, ShieldCheck, Settings, Trophy } from "lucide-react";
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
  const links = [
    ["/dashboard", "Home", LayoutDashboard],
    ["/generate", "Create", Rocket],
    ["/projects", "Projects", FolderKanban],
    ["/timeline", "Timeline", History],
    ["/progress", "Progress", Gamepad2],
    ["/help", "Help", HelpCircle],
    ["/settings", "Settings", Settings],
    ...(canAccessAdmin(profile) ? [["/admin", "Admin", ShieldCheck] as const] : []),
  ] as const;
  const planLabel = entitlements.reason === "lifetime_founder" ? "Lifetime Founder" : entitlements.reason === "beta_founder" ? "Founder beta" : entitlements.reason === "trial" ? "Trial" : entitlements.effectivePlan;

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-ink/10 bg-white/85 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex min-h-20 items-center justify-between px-5 lg:px-7"><Logo /><span className="rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase text-ink">{planLabel}</span></div>
        <div className="border-t border-ink/10 px-4 py-3 text-xs font-semibold leading-5 text-ink/55 lg:border-0">
          Core loop: create a project, contact real people, log proof, then repeat.
        </div>
        <div className="px-4 pb-2"><ProjectSwitcher projects={switcherProjects} currentProjectId={focus?.project_id ?? null} /></div>
        <nav className="flex gap-1 overflow-x-auto border-t border-ink/10 px-3 py-3 lg:grid lg:border-0 lg:px-4" aria-label="Main navigation">
          {links.map(([href, label, Icon]) => <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-ink/65 hover:bg-cream hover:text-ink"><Icon className="size-4" />{label}</Link>)}
        </nav>
        <div className="hidden px-4 lg:absolute lg:bottom-5 lg:block lg:w-[280px]">
          <div className="mb-3"><BetaFeedbackButton /></div>
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-cream to-sky/30 p-4"><p className="truncate text-sm font-bold">{profile.name ?? "Founder"}</p><p className="mt-1 truncate text-xs font-medium text-ink/65">{profile.email}</p><Link href="/beta-guide" className="mt-3 inline-flex text-xs font-black text-violet hover:text-ink">How to test PrismForge</Link></div>
          <form action={logout}><button className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-ink/75 hover:bg-cream">Sign out</button></form>
          <div className="mt-2 flex gap-4 px-4 text-xs font-semibold text-ink/60"><Link href="/privacy" className="hover:text-ink">Privacy</Link><Link href="/terms" className="hover:text-ink">Terms</Link></div>
        </div>
      </aside>
      <div>
        <header className="hidden min-h-20 items-center justify-end border-b border-ink/10 bg-white/70 px-8 backdrop-blur lg:flex"><div className="flex items-center gap-3 text-sm font-medium text-ink/70"><Trophy className="size-4 text-gold" /><span>Stop guessing. Prove one idea with one real action.</span><Bell className="size-4 text-violet" /></div></header>
        <div className="border-b border-ink/10 bg-white/55 px-5 py-3 backdrop-blur lg:hidden"><BetaFeedbackButton /></div>
        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
