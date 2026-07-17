"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "prismforge_email_preferences";

type EmailPreferences = {
  receiveEmails: "yes" | "no";
  frequency: "minimal" | "weekly" | "important";
  categories: Record<string, boolean>;
};

const categories = [
  "Product updates",
  "Streak/progress",
  "Level-up",
  "Market Pulse",
  "Launch reminders",
  "Beta feedback reminders",
  "Billing/account",
];

const defaultPrefs: EmailPreferences = {
  receiveEmails: "no",
  frequency: "weekly",
  categories: Object.fromEntries(categories.map((category) => [category, category === "Billing/account"])),
};

export function EmailPreferencesCard({ initialReceiveEmails = "no" }: { initialReceiveEmails?: EmailPreferences["receiveEmails"] }) {
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<EmailPreferences>({ ...defaultPrefs, receiveEmails: initialReceiveEmails });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EmailPreferences>;
        setPrefs({ ...defaultPrefs, ...parsed, receiveEmails: parsed.receiveEmails ?? initialReceiveEmails });
        return;
      }
    } catch {
      // Local beta preferences are non-critical.
    }
    setPrefs({ ...defaultPrefs, receiveEmails: initialReceiveEmails });
  }, [initialReceiveEmails]);

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setSaved(false);
    }
  }

  if (!mounted) {
    return (
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-ink/55">Loading email preferences...</p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-sm">
      <div className="grid size-12 place-items-center rounded-2xl bg-cream text-violet"><Bell className="size-5" /></div>
      <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Email preferences</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">
        The main digest toggle is saved to your account above. These beta category and frequency choices are saved in this browser so testers can tell us what controls feel useful.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-ink">
          Receive emails?
          <select
            value={prefs.receiveEmails}
            onChange={(event) => setPrefs((current) => ({ ...current, receiveEmails: event.target.value as EmailPreferences["receiveEmails"] }))}
            className="min-h-11 rounded-2xl border border-ink/10 bg-cream/60 px-4 text-sm text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
          >
            <option value="no">No - account/security only</option>
            <option value="yes">Yes - product and progress emails</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-ink">
          Frequency
          <select
            value={prefs.frequency}
            onChange={(event) => setPrefs((current) => ({ ...current, frequency: event.target.value as EmailPreferences["frequency"] }))}
            className="min-h-11 rounded-2xl border border-ink/10 bg-cream/60 px-4 text-sm text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
          >
            <option value="minimal">Minimal</option>
            <option value="weekly">Weekly</option>
            <option value="important">Important updates only</option>
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category} className="flex items-center gap-2 rounded-2xl bg-cream/50 px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={Boolean(prefs.categories[category])}
                onChange={(event) => setPrefs((current) => ({ ...current, categories: { ...current.categories, [category]: event.target.checked } }))}
                className="accent-moss"
              />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save}>Save local preferences</Button>
        {saved && <span className="inline-flex items-center gap-1 text-sm font-bold text-moss"><CheckCircle2 className="size-4" />Saved locally</span>}
      </div>
      <p className="mt-3 text-xs leading-5 text-ink/45">Private beta note: category preferences are local-only for now; the account-level email digest toggle is persisted in Supabase.</p>
    </section>
  );
}
