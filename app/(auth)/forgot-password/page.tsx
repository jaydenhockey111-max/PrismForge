import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { requestPasswordReset } from "@/app/(auth)/actions";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Password reset" title="Check your inbox" description="Enter your account email and we’ll send a secure reset link." footer={<Link className="font-bold text-moss hover:underline" href="/sign-in">Back to sign in</Link>}>
    <form action={requestPasswordReset} className="grid gap-5">
      <FormMessage message={params.error} /><FormMessage message={params.message} type="success" />
      <Field label="Email"><Input type="email" name="email" autoComplete="email" required /></Field>
      <Button type="submit" className="w-full">Send reset link</Button>
    </form>
  </AuthShell>;
}
