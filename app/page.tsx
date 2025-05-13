import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPageContent } from "./landing-page-content";

export default async function LandingPage() {
  const session = await auth();
  if (!session) redirect("/auth");

  return <LandingPageContent />;
}
