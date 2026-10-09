import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildReturnTo } from "@/lib/auth-return";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";
import { AccountPendingPanel } from "@/components/onboarding/account-pending-panel";
import { DocumentUploadContent } from "./document-upload-content";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

export default async function DocumentUploadPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(buildReturnTo("/forms/document-upload", sp));

  const status = await accountOnboardingService.getStatus(session.user.id);
  if (status.state !== "linked" && session.user.role !== "Admin") {
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

  const kind = one(sp, "kind");
  return (
    <DocumentUploadContent
      currentUserId={session.user.id}
      ownEmployeeId={status.state === "linked" ? status.employeeId : null}
      initial={{
        employeeId: Number(one(sp, "employeeId")) || null,
        kind: kind === "Ticket" || kind === "Training" ? kind : null,
        itemId: Number(one(sp, "itemId")) || null,
      }}
      submissionId={Number(one(sp, "submission")) || null}
    />
  );
}
