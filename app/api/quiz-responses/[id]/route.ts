import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { quizService } from "@/lib/services/quizService";
import { mapQuizError } from "@/lib/quiz/api-errors";

export async function GET(
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
    return NextResponse.json({ error: "Invalid response ID" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await quizService.getForActor(id, session.user.id, session.user.role as string),
    );
  } catch (error) {
    return mapQuizError(error) ?? NextResponse.json(
      { error: "Error loading response" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    return NextResponse.json({ error: "Invalid response ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    switch (body.action) {
      case "saveAnswer": {
        const reveal = await quizService.saveAnswer(id, session.user.id, {
          itemId: body.itemId,
          value: body.value,
        });
        return NextResponse.json(reveal);
      }
      case "submit":
        await quizService.submit(id, session.user.id);
        return NextResponse.json({ ok: true });
      case "restart":
        return NextResponse.json(await quizService.restart(id, session.user.id));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return mapQuizError(error) ?? NextResponse.json(
      { error: "Error updating response" },
      { status: 500 },
    );
  }
}
