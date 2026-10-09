import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { quizService } from "@/lib/services/quizService";

async function requireCanEdit(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
  }
  const userRole = session.user.role as UserRole;
  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) {
    return { error: NextResponse.json({ message: "Not authorised" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCanEdit(request);
  if (guard.error) return guard.error;

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  const revisionId = parseInt(request.nextUrl.searchParams.get("revisionId") ?? "");
  if (isNaN(id) || isNaN(revisionId)) {
    return NextResponse.json({ error: "Invalid training or revision ID" }, { status: 400 });
  }

  try {
    const [content, hasResponses] = await Promise.all([
      quizService.getContent(revisionId),
      quizService.revisionHasResponses(revisionId),
    ]);
    return NextResponse.json({ content, hasResponses });
  } catch (error) {
    if (error instanceof Error && error.message === "REVISION_NOT_FOUND") {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error loading quiz content" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCanEdit(request);
  if (guard.error) return guard.error;

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  const revisionId = parseInt(request.nextUrl.searchParams.get("revisionId") ?? "");
  if (isNaN(id) || isNaN(revisionId)) {
    return NextResponse.json({ error: "Invalid training or revision ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content : "";
    const doc = await quizService.setContent(
      id,
      revisionId,
      content,
      guard.session.user.id,
      body.confirm === true,
    );
    return NextResponse.json({ ok: true, document: doc });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "NOT_A_QUESTIONNAIRE":
          return NextResponse.json(
            {
              error:
                "Only the IT induction questionnaire can be edited here. Other training keeps its questions in its SOP.",
            },
            { status: 403 },
          );
        case "QUIZ_CLEAR_LAST":
          return NextResponse.json(
            {
              error:
                "This is the only revision with questions, so the questionnaire can't be removed from it.",
              code: "QUIZ_CLEAR_LAST",
            },
            { status: 409 },
          );
        case "INVALID_QUIZ_CONTENT":
          return NextResponse.json(
            {
              error: "Quiz content is invalid",
              detail: (error as Error & { detail?: string }).detail,
            },
            { status: 400 },
          );
        case "QUIZ_HAS_RESPONSES":
          return NextResponse.json(
            {
              error:
                "This revision already has questionnaire responses. Material changes belong in a new revision — confirm to edit anyway.",
              code: "QUIZ_HAS_RESPONSES",
            },
            { status: 409 },
          );
        case "QUIZ_CLEAR_HAS_RESPONSES":
          return NextResponse.json(
            {
              error:
                "People have already answered this revision, so its questionnaire can't be removed. Add a new revision and remove it there instead.",
              code: "QUIZ_CLEAR_HAS_RESPONSES",
            },
            { status: 409 },
          );
      }
    }
    return NextResponse.json({ error: "Error saving quiz content" }, { status: 500 });
  }
}
