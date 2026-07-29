import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuizPlayer } from "./quiz-player";

export default async function QuizPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  const { id } = await params;
  return <QuizPlayer responseId={parseInt(id)} />;
}
