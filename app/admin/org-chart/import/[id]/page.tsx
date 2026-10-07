import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ImportReviewContent } from "./import-review-content";

export default async function WorkdayImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  const { id } = await params;
  return <ImportReviewContent importId={Number(id)} />;
}
