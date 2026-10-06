import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { EmailLogPageContent } from "./email-log-page-content";

export default async function EmailLogPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <EmailLogPageContent />;
}
