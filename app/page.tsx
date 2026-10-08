import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPageContent } from "./landing-page-content";
import { headers } from "next/headers";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/auth");

  const accountStatus = await accountOnboardingService.getStatus(
    session.user.id,
  );

  return (
    <LandingPageContent
      accountStatus={accountStatus}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
