import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildReturnTo } from "@/lib/auth-return";
import { ReviewContent } from "./review-content";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(buildReturnTo(`/expiring/review/${encodeURIComponent(id)}`, {}));
  if (session.user.role !== "Admin") redirect("/expiring");
  return <ReviewContent id={Number(id)} />;
}
