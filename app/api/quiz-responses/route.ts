import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { quizService } from "@/lib/services/quizService";
import { mapQuizError } from "@/lib/quiz/api-errors";

// GET (default) → the caller's own responses
// GET ?view=completed → Admin: completed responses (optionally ?trainingId=)
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const view = request.nextUrl.searchParams.get("view");

  try {
    if (view === "completed") {
      if (session.user.role !== "Admin") {
        return NextResponse.json({ error: "Not authorised" }, { status: 403 });
      }
      const trainingIdParam = request.nextUrl.searchParams.get("trainingId");
      const trainingId = trainingIdParam ? Number(trainingIdParam) : undefined;
      return NextResponse.json(
        await quizService.listCompleted(
          Number.isInteger(trainingId) ? trainingId : undefined,
        ),
      );
    }
    if (view === "assigned") {
      return NextResponse.json(await quizService.listAssigned(session.user.id));
    }
    return NextResponse.json(await quizService.listMine(session.user.id));
  } catch (error) {
    return mapQuizError(error) ?? NextResponse.json(
      { error: "Error listing responses" },
      { status: 500 },
    );
  }
}

// POST { trainingId } → start (or resume) a response
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
    const response = await quizService.start(session.user.id, trainingId);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return mapQuizError(error) ?? NextResponse.json(
      { error: "Error starting response" },
      { status: 500 },
    );
  }
}
