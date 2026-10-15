import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QuizPlayer } from "./quiz-player";

export default async function QuizPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  const { id } = await params;
  const { from } = await searchParams;
  return (
    <QuizPlayer
      key={`${id}-${from ?? ""}`}
      responseId={parseInt(id)}
      startAt={from === "start" ? "start" : "resume"}
    />
  );
}
