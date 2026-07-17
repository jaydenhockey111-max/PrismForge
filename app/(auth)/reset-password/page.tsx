import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { updatePassword } from "@/app/(auth)/actions";

export const metadata = { title: "Choose new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell eyebrow="Almost there" title="Choose a new password" description="Make it at least eight characters and hard to guess." footer="Your reset session expires automatically for your security.">
    <form action={updatePassword} className="grid gap-5"><FormMessage message={error} /><Field label="New password"><Input type="password" name="password" autoComplete="new-password" minLength={8} required /></Field><Button type="submit" className="w-full">Update password</Button></form>
  </AuthShell>;
}
