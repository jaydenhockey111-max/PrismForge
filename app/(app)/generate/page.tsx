import { Rocket, Sparkles } from "lucide-react";
import { ContextualFieldSuggestions, GenerateFieldSuggestions, GenerateFormPersistence } from "@/components/founder-os/generate-form-persistence";
import { FormMessage, Input, Select, Textarea, Field } from "@/components/ui/form";
import { LoadingGenerationState } from "@/components/founder-os/loading-generation-state";
import { SaveProjectButton } from "@/components/founder-os/save-project-button";
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPES, FOUNDER_GOALS, GOAL_LABELS } from "@/lib/founder-os/helpers";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { generateFounderProject } from "@/app/(app)/generate/actions";
import { getFounderIntelligence } from "@/lib/founder-intelligence/server";

export const metadata = { title: "Create Project" };

export default async function GeneratePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [params, profile] = await Promise.all([searchParams, requireProfile()]);
  await logBetaEvent({ userId: profile.id, eventName: "project_creation_page_viewed", source: "generate_page", throttleSeconds: 15 * 60 });
  await logBetaEvent({ userId: profile.id, eventName: "project_creation_page_opened", source: "generate_page", throttleSeconds: 15 * 60 });
  const intelligence = await getFounderIntelligence(profile.id);
  const requestId = crypto.randomUUID();
  const defaultHours = Math.min(100, Math.max(1, Math.round(intelligence.profile.declaredContext.hoursPerWeek ?? 8)));
  const defaultRisk = Math.min(10, Math.max(1, Math.round(intelligence.profile.declaredContext.riskTolerance ?? 5)));

  return (
    <div className="mx-auto max-w-5xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-ink p-8 text-white shadow-glow">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-gold">
            <Sparkles className="size-4" />
            Create project
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">Create your project workspace.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-white/70">
            Start with rough answers. PrismForge will turn them into one clear project summary, one unproven question, and one realistic test.
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-violet/15 bg-white p-4 text-sm leading-6 text-ink/65">
        <span className="font-black text-ink">Your guidance:</span> {intelligence.profile.explicitPreferences.guidanceMode} style, {intelligence.profile.explicitPreferences.questIntensity} weekly pace. Saved time and risk constraints are prefilled when reliable; your new answers remain the source of truth.
      </section>

      <section className="mt-6 rounded-[1.5rem] border border-moss/15 bg-lime/25 p-5">
        <p className="text-sm font-black uppercase tracking-[.16em] text-moss">What you will receive</p>
        <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-ink/70 sm:grid-cols-3">
          {["A concise project summary", "The biggest question to test", "One complete Next Best Action"].map((item) => (
            <div key={item} className="rounded-2xl bg-white/80 p-4">{item}</div>
          ))}
        </div>
      </section>

      <form id="founder-generate-form" action={generateFounderProject} className="mt-8 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        <GenerateFormPersistence formId="founder-generate-form" />
        <input type="hidden" name="generationRequestId" value={requestId} />
        <FormMessage message={params.error} />

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="What are you interested in?" hint="Pick a few areas. These guide the project direction.">
            <Textarea name="interests" required minLength={2} placeholder="AI tools, student productivity, local business, content creation" />
            <GenerateFieldSuggestions field="interests" category="general_interests" suggestions={["AI tools", "Student productivity", "Sports training", "Local business", "Content creation"]} />
          </Field>

          <Field label="What skills do you have?" hint="Use commas or short phrases. This helps PrismForge choose a realistic test and MVP scope.">
            <Textarea name="skills" required minLength={2} placeholder="coding, writing, research, sales, design" />
            <GenerateFieldSuggestions field="skills" category="general_skills" suggestions={["Coding", "Writing", "Research", "Sales", "Design"]} />
          </Field>

          <Field label="How much money can you spend to start?">
            <Input name="budget" type="number" min="0" max="1000000" required defaultValue="100" />
            <GenerateFieldSuggestions field="budget" category="starter_budget" suggestions={["0", "50", "100", "250"]} append={false} />
          </Field>

          <Field label="How many hours/week can you work?">
            <Input name="timePerWeek" type="number" min="1" max="100" required defaultValue={defaultHours} />
            <GenerateFieldSuggestions field="timePerWeek" category="weekly_time" suggestions={["3", "5", "8", "12"]} append={false} />
          </Field>

          <Field label="Who do you want to sell to?" hint="If unsure, choose the closest audience. You can edit it.">
            <Input name="targetAudience" required minLength={2} placeholder="high school students, local gyms, busy parents, creators" />
            <ContextualFieldSuggestions field="targetAudience" />
          </Field>

          <Field label="Preferred business type">
            <Select name="businessType" required defaultValue="ai_tool">
              {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>)}
            </Select>
          </Field>

          <Field label="Goal">
            <Select name="goal" required defaultValue="side_income">
              {FOUNDER_GOALS.map((goal) => <option key={goal} value={goal}>{GOAL_LABELS[goal]}</option>)}
            </Select>
          </Field>

          <Field label="Risk tolerance" hint="1 = careful and slow, 10 = aggressive experiments">
            <Input name="riskTolerance" type="range" min="1" max="10" defaultValue={defaultRisk} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Any idea you already have? Optional" hint="No idea yet? Leave this blank. PrismForge can still create a grounded starter direction.">
              <Textarea name="existingIdea" placeholder="Example: No-code study planning tool for students — or leave blank for Guided Idea Mode" />
              <ContextualFieldSuggestions field="existingIdea" />
            </Field>
          </div>
        </div>

        <div className="mt-7 flex flex-col justify-between gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm leading-6 text-ink/55">
            Totally fine if you are unsure. Placeholder answers like “no idea” or “whatever” are treated as missing, and PrismForge will recover locally instead of saving nonsense. If generation fails, your answers stay saved so you can retry.
          </p>
          <SaveProjectButton />
        </div>
        <LoadingGenerationState />
      </form>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Validate before you build", "Pressure-test demand and willingness to act before spending weeks coding."],
          ["Know what to do next", "Your workspace starts with one clear action instead of a wall of advice."],
          ["Useful without perfect inputs", "If you are unsure, PrismForge creates a realistic starter direction from your answers."],
        ].map(([title, description]) => (
          <div key={title} className="rounded-2xl border border-ink/10 bg-white/75 p-5">
            <Rocket className="size-5 text-violet" />
            <h2 className="mt-3 font-display text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
