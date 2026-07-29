import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuizResultDetail } from "./quiz-result-detail";

export default async function QuizResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  const { id } = await params;
  return <QuizResultDetail responseId={parseInt(id)} />;
}
