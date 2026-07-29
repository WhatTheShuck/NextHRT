import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuizListContent } from "./quiz-list-content";

export default async function QuizListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  return <QuizListContent />;
}
