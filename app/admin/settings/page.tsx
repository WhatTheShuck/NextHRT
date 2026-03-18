import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SettingsPageContent } from "./settings-page-content";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  return <SettingsPageContent />;
}
