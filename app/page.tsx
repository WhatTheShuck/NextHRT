import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPageContent } from "./landing-page-content";
import { headers } from "next/headers";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/auth");

  return <LandingPageContent />;
}
