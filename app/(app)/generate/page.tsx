import { Check, Rocket } from "lucide-react";
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
      <section className="max-w-3xl">
        <p className="eyebrow">Create project</p>
        <h1 className="page-title mt-4">Turn rough context into a focused workspace.</h1>
        <p className="page-intro mt-5">
          Short, imperfect answers are enough. PrismForge will find the most important uncertainty and prepare a realistic first test.
        </p>
      </section>

      <section className="mt-10 grid gap-5 rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-card lg:grid-cols-[.75fr_1.25fr] lg:p-6">
        <div>
          <p className="eyebrow">What you receive</p>
          <p className="mt-3 text-sm leading-6 text-ink/55">Enough structure to act, without pretending the idea is already proven.</p>
        </div>
        <div className="grid gap-2 text-sm font-semibold leading-6 text-ink/70 sm:grid-cols-3">
          {["A concise project summary", "The biggest question to test", "One complete Next Best Action"].map((item) => (
            <div key={item} className="flex gap-2 rounded-xl bg-cream/65 p-4"><Check className="mt-1 size-4 shrink-0 text-violet" />{item}</div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-violet/15 bg-violet/[.045] px-4 py-3 text-sm leading-6 text-ink/60">
        <span className="font-semibold text-ink">Personalized defaults:</span> {intelligence.profile.explicitPreferences.guidanceMode} guidance, {intelligence.profile.explicitPreferences.questIntensity} weekly pace. You can override every saved suggestion below.
      </section>

      <form id="founder-generate-form" action={generateFounderProject} className="mt-8 rounded-[1.5rem] border border-ink/10 bg-white p-6 shadow-card sm:p-8 lg:p-10">
        <GenerateFormPersistence formId="founder-generate-form" />
        <input type="hidden" name="generationRequestId" value={requestId} />
        <FormMessage message={params.error} />

        <div className="mb-8 border-b border-ink/10 pb-6">
          <p className="eyebrow">Project context</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.025em] text-ink">Tell us what is true right now.</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">Use plain language. These answers define the boundaries of the first test.</p>
        </div>

        <div className="grid gap-x-6 gap-y-7 md:grid-cols-2">
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

        <div className="mt-9 flex flex-col justify-between gap-5 border-t border-ink/10 pt-7 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm leading-6 text-ink/55">
            Totally fine if you are unsure. Placeholder answers like “no idea” or “whatever” are treated as missing, and PrismForge will recover locally instead of saving nonsense. If generation fails, your answers stay saved so you can retry.
          </p>
          <SaveProjectButton />
        </div>
        <LoadingGenerationState />
      </form>

      <section className="mt-10 grid gap-4 border-t border-ink/10 pt-10 md:grid-cols-3">
        {[
          ["Validate before you build", "Pressure-test demand and willingness to act before spending weeks coding."],
          ["Know what to do next", "Your workspace starts with one clear action instead of a wall of advice."],
          ["Useful without perfect inputs", "If you are unsure, PrismForge creates a realistic starter direction from your answers."],
        ].map(([title, description]) => (
          <div key={title} className="rounded-xl border border-ink/10 bg-white/70 p-5">
            <Rocket className="size-5 text-violet" />
            <h2 className="mt-3 font-display text-lg font-semibold tracking-[-.015em]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
