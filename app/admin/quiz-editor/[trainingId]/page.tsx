import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { UserRole } from "@/generated/prisma_client/client";
import { quizService } from "@/lib/services/quizService";
import { QuizEditor } from "./quiz-editor";

export default async function QuizEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ trainingId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  // Same gate as the quiz-content API this page saves through.
  const canEdit = await auth.api.userHasPermission({
    body: { role: session.user.role as UserRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) redirect("/");

  const { trainingId } = await params;
  const id = parseInt(trainingId);
  if (isNaN(id)) notFound();

  const context = await quizService.getEditorContext(id);
  if (!context || context.category === "SOP") notFound();

  const { revisionId } = await searchParams;
  const requested = typeof revisionId === "string" ? parseInt(revisionId) : NaN;
  const initialRevisionId = context.revisions.some((r) => r.id === requested) ? requested : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <QuizEditor context={context} initialRevisionId={initialRevisionId} />
    </div>
  );
}
