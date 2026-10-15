import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildReturnTo } from "@/lib/auth-return";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";
import { AccountPendingPanel } from "@/components/onboarding/account-pending-panel";
import { ExpiringPageContent } from "./expiring-page-content";

type SP = Record<string, string | string[] | undefined>;

export default async function ExpiringPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(buildReturnTo("/expiring", sp));

  const isAdmin = session.user.role === "Admin";
  const status = await accountOnboardingService.getStatus(session.user.id);
  if (status.state !== "linked" && !isAdmin) {
    return (
      <div className="max-w-screen-2xl mx-auto p-4">
        <AccountPendingPanel
          name={session.user.name}
          email={session.user.email}
          note="Come back to this link once your account is linked, or give the document to your manager to upload for you."
        />
      </div>
    );
  }
  return <ExpiringPageContent isAdmin={isAdmin} initialTab={typeof sp.tab === "string" ? sp.tab : undefined} />;
}
