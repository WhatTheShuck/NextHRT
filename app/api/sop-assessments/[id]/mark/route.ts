import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { sopAssessmentService } from "@/lib/services/sopAssessmentService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid assessment ID" }, { status: 400 });
  }

  try {
    const body = await request.json(); // { action: "pass"|"requestChanges", verdicts: [...] }
    if (body.action !== "pass" && body.action !== "requestChanges") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    await sopAssessmentService.mark(
      id,
      session.user.id,
      session.user.role as string,
      {
        action: body.action,
        verdicts: body.verdicts ?? [],
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json({ error: "Training not found" }, { status: 404 });
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "ASSESSMENT_NOT_FOUND":
          return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        case "NOT_AUTHORISED":
          return NextResponse.json({ error: "Not authorised" }, { status: 403 });
        case "NOT_A_TASK_SHEET":
        case "NOT_AN_SOP_PAIR":
        case "INVALID_FILE_TYPE":
        case "FILE_TOO_LARGE":
        case "INVALID_QUESTION":
        case "INVALID_ANSWER":
        case "ANSWER_LOCKED":
        case "INVALID_STATE":
        case "INCOMPLETE_ANSWERS":
        case "MISSING_VERDICTS":
        case "VERDICT_MISMATCH":
        case "SOP_NOT_READY":
        case "NO_LINKED_EMPLOYEE":
          return NextResponse.json({ error: error.message }, { status: 400 });
        case "QUESTION_IN_USE": {
          const count = (error as Error & { count?: number }).count ?? 0;
          return NextResponse.json(
            { error: `In use by ${count} assessment(s) — the question can't be deleted.` },
            { status: 400 },
          );
        }
      }
    }
    return NextResponse.json({ error: "Error marking assessment" }, { status: 500 });
  }
}
