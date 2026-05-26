import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ApprovalsPageContent } from "./approvals-page-content";

export default async function ApprovalsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");

  return <ApprovalsPageContent />;
}
