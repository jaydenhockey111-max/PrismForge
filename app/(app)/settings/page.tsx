import { Check, Download, HelpCircle, Mail, ShieldAlert, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { deleteAccount } from "@/app/(app)/account/actions";
import { updateProfile } from "@/app/(app)/profile/actions";
import { EmailPreferencesCard } from "@/components/email-preferences-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import { INCOME_RANGES, INTERESTS, STUDENT_STATUSES, US_STATES } from "@/lib/constants";
import { GuidanceSettingsCard } from "@/components/founder-intelligence/guidance-settings-card";
import { getFounderIntelligence } from "@/lib/founder-intelligence/server";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = "jayden.hockey111@gmail.com";
const SUPPORT_SUBJECT = "PrismForge beta support";
const SUPPORT_BODY = "Hi Jayden,%0D%0A%0D%0AI need help with PrismForge.%0D%0A%0D%0AWhat happened:%0D%0A%0D%0APage or project:%0D%0A%0D%0A";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [profile, params] = await Promise.all([requireProfile(), searchParams]);
  const intelligence = await getFounderIntelligence(profile.id);
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${SUPPORT_BODY}`;

  return (
    <div className="max-w-6xl">
      <FormMessage message={params.message} type="success" />
      <FormMessage message={params.error} />

      <section className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-white p-7 shadow-card">
        <div className="absolute -right-16 -top-16 size-52 rounded-full bg-violet/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <SlidersHorizontal className="size-4" />
            Settings
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">One clean control center.</h1>
          <p className="mt-3 max-w-2xl text-ink/60">
            Profile, email preferences, data export, account deletion, and support now live here so testers do not have to hunt through duplicate pages.
          </p>
        </div>
      </section>

      <GuidanceSettingsCard profile={intelligence.profile} />

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <section className="rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-violet/10 text-violet">
              <UserRound className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[.16em] text-violet">Founder profile</p>
              <h2 className="font-display text-3xl font-semibold text-ink">Tune your PrismForge signal.</h2>
            </div>
          </div>

          <form action={updateProfile} className="mt-7 grid gap-6">
            <input type="hidden" name="return_to" value="settings" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name"><Input name="name" defaultValue={profile.name ?? ""} autoComplete="name" required /></Field>
              <Field label="Age"><Input type="number" name="age" min={13} max={120} defaultValue={profile.age ?? ""} required /></Field>
              <Field label="State"><Select name="state" defaultValue={profile.state ?? ""} required><option value="" disabled>Select a state</option>{US_STATES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
              <Field label="Income range"><Select name="income_range" defaultValue={profile.income_range ?? ""} required><option value="" disabled>Select a range</option>{INCOME_RANGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
              <Field label="Founder status"><Select name="student_status" defaultValue={profile.student_status ?? ""} required><option value="" disabled>Select a status</option>{STUDENT_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
              <Field label="Current role"><Input name="occupation" defaultValue={profile.occupation ?? ""} placeholder="Student founder, builder, operator..." required /></Field>
              <Field label="Education / experience"><Input name="education_level" defaultValue={profile.education_level ?? ""} placeholder="11th grade, college sophomore, self-taught builder..." /></Field>
              <Field label="Portfolio, LinkedIn, or resume link"><Input name="resume_link" defaultValue={profile.resume_link ?? ""} placeholder="https://..." /></Field>
            </div>

            <Field label="Founder goals" hint="Example: validate an AI tool, launch a private alpha, get first users.">
              <textarea name="goals" defaultValue={profile.goals ?? ""} rows={4} className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-4 focus:ring-lime/40" />
            </Field>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">Founder interests</legend>
              <p className="mt-1 text-xs text-ink/55">Choose what you care about. This improves reports, founder-fit scoring, and Market Pulse context.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <label key={interest} className="cursor-pointer">
                    <input className="peer sr-only" type="checkbox" name="interests" value={interest} defaultChecked={profile.interests.includes(interest)} />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:shadow-sm peer-checked:border-moss peer-checked:bg-lime/60">
                      <Check className="hidden size-3 peer-checked:block" />
                      {interest}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream/70 p-4 text-ink">
              <input type="checkbox" name="alerts_enabled" defaultChecked={profile.alerts_enabled} className="mt-1 size-4 accent-moss" />
              <span>
                <span className="block text-sm font-bold">Founder email digests</span>
                <span className="mt-1 block text-xs leading-5 text-ink/60">Persisted in Supabase. If this is off, non-essential founder digest emails are not queued.</span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </section>

        <div className="grid gap-5">
          <EmailPreferencesCard initialReceiveEmails={profile.alerts_enabled ? "yes" : "no"} />

          <section className="rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-sm">
            <div className="grid size-12 place-items-center rounded-2xl bg-moss/10 text-moss"><Download className="size-5" /></div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Export your data</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">Download your profile, saved projects, progress, rewards, and notification history as JSON.</p>
            <ButtonLink href="/account/export" className="mt-5">Download JSON</ButtonLink>
          </section>

          <section className="rounded-[1.75rem] border border-violet/15 bg-white p-6 shadow-sm">
            <div className="grid size-12 place-items-center rounded-2xl bg-violet/10 text-violet"><HelpCircle className="size-5" /></div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Need help?</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">Email the beta support inbox with what felt confusing, useful, broken, or missing.</p>
            <a href={mailto} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-cream px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
              <Mail className="size-4" />
              Email support
            </a>
          </section>

          <section className="rounded-[1.75rem] border border-red-200 bg-white p-6 shadow-sm">
            <div className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert className="size-5" /></div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Delete account</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">Permanent and serious. This requests account deletion and removes local access.</p>
            <form action={deleteAccount} className="mt-5 grid gap-4">
              <Field label="Type DELETE to confirm"><Input name="confirmation" placeholder="DELETE" autoComplete="off" /></Field>
              <Button type="submit" variant="danger" className="gap-2"><Trash2 className="size-4" />Delete {profile.email}</Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
