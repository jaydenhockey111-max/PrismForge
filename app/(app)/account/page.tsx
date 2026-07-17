import { redirect } from "next/navigation";

export const metadata = { title: "Account" };

export default function AccountPage() {
  redirect("/settings");
}
