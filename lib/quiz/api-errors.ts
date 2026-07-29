import { NextResponse } from "next/server";

/**
 * Map a quizService error to a NextResponse. Returns null for unrecognised
 * errors so the caller can fall through to its own 500.
 */
export function mapQuizError(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case "RESPONSE_NOT_FOUND":
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    case "REVISION_NOT_FOUND":
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    case "NOT_AUTHORISED":
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    case "NO_LINKED_EMPLOYEE":
      return NextResponse.json({ error: "No linked employee" }, { status: 400 });
    case "QUIZ_NOT_READY":
      return NextResponse.json({ error: "Questionnaire not ready" }, { status: 400 });
    case "INVALID_STATE":
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    case "INVALID_ITEM":
      return NextResponse.json({ error: "Unknown question" }, { status: 400 });
    case "INVALID_VALUE":
      return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    case "ITEM_LOCKED":
      return NextResponse.json({ error: "This answer is locked" }, { status: 400 });
    case "INCOMPLETE":
      return NextResponse.json({ error: "Some required questions are unanswered" }, { status: 400 });
    default:
      return null;
  }
}
