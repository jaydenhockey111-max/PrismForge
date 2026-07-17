"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[60vh] place-items-center px-5 text-center"><div><h1 className="font-display text-3xl font-semibold">Something wandered off course.</h1><p className="mt-3 text-ink/60">The error was recorded. Try the request once more.</p><Button onClick={reset} className="mt-6">Try again</Button></div></main>;
}
