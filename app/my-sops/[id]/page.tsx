import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AssessmentContent } from "./assessment-content";

export default async function MySopAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  const { id } = await params;
  return <AssessmentContent assessmentId={parseInt(id)} />;
}
