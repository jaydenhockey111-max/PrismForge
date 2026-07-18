"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem("prismforge-theme", nextTheme);
    setTheme(nextTheme);
  }

  const nextLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white/80 px-3 text-sm font-semibold text-ink/65 shadow-sm transition hover:-translate-y-px hover:border-violet/35 hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet",
        compact && "size-10 min-h-10 px-0",
      )}
    >
      {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
      {!compact && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
