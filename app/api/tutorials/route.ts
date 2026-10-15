import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { isTutorialMode, tutorialService } from "@/lib/services/tutorialService";

// The caller's page-tour settings and progress. Only ever touches the caller's own row.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const state = await tutorialService.getState(session.user.id, session.user.role);
  if (!state) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  return NextResponse.json(state);
}

export async function PUT(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
  if (!isTutorialMode(body.mode)) {
    return NextResponse.json(
      { message: "mode must be Off, FirstVisit or Always" },
      { status: 400 },
    );
  }

  await tutorialService.setMode(session.user.id, body.mode);
  return NextResponse.json({ success: true });
}
