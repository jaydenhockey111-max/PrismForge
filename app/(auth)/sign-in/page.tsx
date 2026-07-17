import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { signIn, signInWithGoogle } from "@/app/(auth)/actions";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Welcome back" title="Sign in" description="Continue your current project, review what changed, and take the next evidence-backed action." footer={<>New here? <Link className="font-bold text-violet hover:underline" href="/sign-up">Create an account</Link></>}>
    <form action={signInWithGoogle} className="mb-5">
      <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
      <Button type="submit" variant="secondary" className="w-full gap-2 border-white/70 bg-white/85 hover:bg-white">Continue with Google</Button>
    </form>
    <div className="mb-5 flex items-center gap-3 text-xs font-black uppercase tracking-[.14em] text-ink/65"><span className="h-px flex-1 bg-ink/15" />or use email<span className="h-px flex-1 bg-ink/15" /></div>
    <form action={signIn} className="grid gap-5">
      <FormMessage message={params.error} /><FormMessage message={params.message} type="success" />
      <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
      <Field label="Email"><Input type="email" name="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input type="password" name="password" autoComplete="current-password" minLength={8} required /></Field>
      <div className="-mt-2 text-right"><Link className="text-sm font-semibold text-moss hover:underline" href="/forgot-password">Forgot password?</Link></div>
      <Button type="submit" className="w-full">Sign in</Button>
    </form>
  </AuthShell>;
}
