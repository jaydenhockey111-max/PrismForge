import Link from "next/link";

export const metadata = { title: "Legacy resources disabled" };

export default function EditOpportunityPage() {
  return (
    <div className="max-w-3xl rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-soft">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-moss">Admin</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Legacy resource editing is disabled</h1>
      <p className="mt-3 text-ink/60">
        Legacy resource records are no longer managed through the app. This prevents accidental broad-search/admin work while PrismForge is in private alpha.
      </p>
      <Link href="/admin" className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5">
        Back to owner workspace
      </Link>
    </div>
  );
}
