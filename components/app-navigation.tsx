"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/generate", label: "Create", icon: Plus },
  { href: "/projects", label: "Projects", icon: FolderKanban },
] as const;

const secondaryLinks = [
  { href: "/progress", label: "Review", icon: BookOpenCheck },
] as const;

const utilityLinks = [
  { href: "/help", label: "Help", icon: CircleHelp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppNavigation({ admin = false, mobile = false }: { admin?: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const utilities = admin ? [...utilityLinks, { href: "/admin", label: "Admin", icon: ShieldCheck }] : utilityLinks;

  if (mobile) {
    return (
      <nav className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Product navigation">
        {[...primaryLinks, ...secondaryLinks, ...utilities].map((item) => (
          <NavigationLink key={item.href} {...item} active={isActive(pathname, item.href)} compact />
        ))}
      </nav>
    );
  }

  return (
    <nav className="grid gap-6" aria-label="Product navigation">
      <NavigationGroup label="Workspace" items={primaryLinks} pathname={pathname} />
      <NavigationGroup label="Learn" items={secondaryLinks} pathname={pathname} />
      <NavigationGroup label="Account" items={utilities} pathname={pathname} />
    </nav>
  );
}

function NavigationGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: ReadonlyArray<{ href: string; label: string; icon: typeof LayoutDashboard }>;
  pathname: string;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[.6875rem] font-bold uppercase tracking-[.16em] text-ink/35">{label}</p>
      <div className="grid gap-1">
        {items.map((item) => (
          <NavigationLink key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </div>
  );
}

function NavigationLink({
  href,
  label,
  icon: Icon,
  active,
  compact = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet",
        compact ? "min-h-10 shrink-0 px-3" : "min-h-11 px-3",
        active ? "bg-violet/10 text-violet" : "text-ink/60 hover:bg-ink/[.045] hover:text-ink",
      )}
    >
      <Icon className="size-[1.125rem] shrink-0" strokeWidth={active ? 2.25 : 1.8} />
      {label}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
