import { redirect } from "next/navigation";

export const metadata = { title: "Profile" };

export default function ProfilePage() {
  redirect("/settings");
}
