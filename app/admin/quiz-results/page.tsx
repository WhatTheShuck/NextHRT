import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuizResultsContent } from "./quiz-results-content";

export default async function QuizResultsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <QuizResultsContent />;
}
