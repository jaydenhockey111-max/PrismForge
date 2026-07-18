import { BrainCircuit, RefreshCcw, ShieldCheck } from "lucide-react";
import { resetFounderPersonalization, updateGuidancePreferences } from "@/app/(app)/settings/guidance-actions";
import type { FounderIntelligenceProfile } from "@/lib/founder-intelligence/types";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";

export function GuidanceSettingsCard({ profile }: { profile: FounderIntelligenceProfile }) {
  const preferences = profile.explicitPreferences;
  return (
    <section className="mt-6 rounded-[2rem] border border-violet/15 bg-gradient-to-br from-white via-violet/5 to-lime/15 p-6 shadow-card sm:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet"><BrainCircuit className="size-4" />Guidance style</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Choose how PrismForge helps you.</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">Your choices override historical recommendations. This changes presentation and action scope—not evidence rules, access, or project validation.</p>
        </div>
        <div className="rounded-2xl border border-moss/15 bg-white px-4 py-3 text-sm font-semibold text-ink/70">
          <ShieldCheck className="mr-2 inline size-4 text-moss" />No automatic AI calls
        </div>
      </div>

      <form action={updateGuidancePreferences} className="mt-6 grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Guidance Style" hint="Guided explains more; Autonomous shows more choices.">
            <Select name="guidance_mode" defaultValue={preferences.guidanceMode}>
              <option value="guided">Guided</option><option value="balanced">Balanced</option><option value="autonomous">Autonomous</option>
            </Select>
          </Field>
          <Field label="Explanation Detail" hint="Critical trust and safety information always remains visible.">
            <Select name="explanation_depth" defaultValue={preferences.explanationDepth}>
              <option value="brief">Brief</option><option value="standard">Standard</option><option value="detailed">Detailed</option>
            </Select>
          </Field>
          <Field label="Action Pace" hint="Pace changes recommendation scope, never evidence rules.">
            <Select name="quest_intensity" defaultValue={preferences.questIntensity}>
              <option value="light">Light</option><option value="standard">Standard</option><option value="ambitious">Ambitious</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Toggle name="historical_personalization_enabled" defaultChecked={preferences.historicalPersonalizationEnabled} title="Use Lessons From Previous Projects" description="Only active, comparable, evidence-backed patterns may be used." />
          <Toggle name="show_historical_reminders" defaultChecked={preferences.showHistoricalReminders} title="Show Historical Reminders" description="Show at most two relevant reminders beside current work." />
          <Toggle name="show_personalization_reasons" defaultChecked={preferences.showPersonalizationReasons} title="Explain Personalization" description="Show why the presentation or scope changed." />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ink/50">Current recommendation: {label(profile.adaptationState.guidanceModeRecommendation)} guidance, {label(profile.adaptationState.questScopeRecommendation)} pace. You remain in control.</p>
          <Button type="submit">Save guidance settings</Button>
        </div>
      </form>

      <form action={resetFounderPersonalization} className="mt-5 border-t border-ink/10 pt-5">
        <Button type="submit" variant="secondary" className="gap-2"><RefreshCcw className="size-4" />Reset inferred personalization</Button>
        <p className="mt-2 text-xs leading-5 text-ink/50">Rebuilds derived guidance from currently authorized history while keeping your explicit choices.</p>
      </form>
    </section>
  );
}

function Toggle({ name, defaultChecked, title, description }: { name: string; defaultChecked: boolean; title: string; description: string }) {
  return <label className="flex cursor-pointer gap-3 rounded-2xl border border-ink/10 bg-white p-4"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-moss" /><span><span className="block text-sm font-black text-ink">{title}</span><span className="mt-1 block text-xs leading-5 text-ink/55">{description}</span></span></label>;
}
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

