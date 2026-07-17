import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { signInWithGoogle, signUp } from "@/app/(auth)/actions";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <AuthShell eyebrow="Start testing" title="Create your account" description="Turn a rough idea into one clear assumption, one realistic test, and one useful next action." footer={<>Already have an account? <Link className="font-bold text-violet hover:underline" href={`/sign-in?next=${encodeURIComponent(safeNext)}`}>Sign in</Link></>}>
    <form action={signInWithGoogle} className="mb-5">
      <input type="hidden" name="next" value={safeNext} />
      <Button type="submit" variant="secondary" className="w-full gap-2 border-white/70 bg-white/85 hover:bg-white">Continue with Google</Button>
    </form>
    <div className="mb-5 flex items-center gap-3 text-xs font-black uppercase tracking-[.14em] text-ink/65"><span className="h-px flex-1 bg-ink/15" />or create with email<span className="h-px flex-1 bg-ink/15" /></div>
    <form action={signUp} className="grid gap-5">
      <FormMessage message={error} />
      <input type="hidden" name="next" value={safeNext} />
      <Field label="Name"><Input name="name" autoComplete="name" minLength={2} required placeholder="Alex Morgan" /></Field>
      <Field label="Email"><Input type="email" name="email" autoComplete="email" required placeholder="alex@example.com" /></Field>
      <Field label="Password" hint="Use at least 8 characters."><Input type="password" name="password" autoComplete="new-password" minLength={8} required /></Field>
      <Button type="submit" className="mt-1 w-full">Create free account</Button>
    </form>
  </AuthShell>;
}
