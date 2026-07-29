import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SopReviewsPageContent } from "./sop-reviews-page-content";

export default async function SopReviewsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  return <SopReviewsPageContent />;
}
