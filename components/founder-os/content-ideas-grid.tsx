import type { ContentPlan } from "@/lib/founder-os/types";

export function ContentIdeasGrid({ plan }: { plan: ContentPlan }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <IdeaPanel title="TikTok/Reels/Shorts hooks" items={plan.shortFormHooks} />
      <IdeaPanel title="Tweet/X ideas" items={plan.tweetIdeas} />
      <IdeaPanel title="Reddit angles" items={plan.redditAngles} />
      <IdeaPanel title="SEO article titles" items={plan.seoArticleTitles} />
      <div className="rounded-2xl border border-ink/10 bg-ink p-5 text-white lg:col-span-2">
        <p className="text-sm font-black uppercase tracking-[.14em] text-gold">Viral angles</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Angle title="Shock value" value={plan.shockValueAngle} />
          <Angle title="Educational" value={plan.educationalAngle} />
          <Angle title="Building in public" value={plan.buildingInPublicAngle} />
        </div>
      </div>
    </div>
  );
}

function IdeaPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}

function Angle({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl bg-white/10 p-4"><p className="font-bold text-gold">{title}</p><p className="mt-2 text-sm leading-6 text-white/70">{value}</p></div>;
}
