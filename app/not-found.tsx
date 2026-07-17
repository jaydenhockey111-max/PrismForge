import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return <main className="paper-grid grid min-h-screen place-items-center px-5 text-center"><div><p className="font-display text-8xl font-semibold text-coral">404</p><h1 className="mt-4 font-display text-3xl font-semibold">This trail went cold.</h1><p className="mt-3 text-ink/60">The page you’re looking for doesn’t exist.</p><ButtonLink href="/" className="mt-7">Back home</ButtonLink></div></main>;
}
