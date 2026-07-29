import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { sopAssessmentService } from "@/lib/services/sopAssessmentService";

// GET ?scope=mine (default) → the caller's SOP list
// GET ?scope=queue → Submitted assessments the caller may mark
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const scope = request.nextUrl.searchParams.get("scope") ?? "mine";

  try {
    if (scope === "queue") {
      return NextResponse.json(
        await sopAssessmentService.listQueue(
          session.user.id,
          session.user.role as string,
        ),
      );
    }
    return NextResponse.json(await sopAssessmentService.listMine(session.user.id));
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
    return NextResponse.json({ error: "Error listing assessments" }, { status: 500 });
  }
}

// POST { trainingId } → start (or resume) an assessment
export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const trainingId = Number(body.trainingId);
    if (!Number.isInteger(trainingId)) {
      return NextResponse.json({ error: "Invalid trainingId" }, { status: 400 });
    }
    const assessment = await sopAssessmentService.start(session.user.id, trainingId);
    return NextResponse.json(assessment, { status: 201 });
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
    return NextResponse.json({ error: "Error starting assessment" }, { status: 500 });
  }
}
