import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MissingAttachmentsPageContent } from "./missing-attachments-page-content";

export default async function MissingAttachmentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <MissingAttachmentsPageContent />;
}
