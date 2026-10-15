import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { isTutorialKey, tutorialService } from "@/lib/services/tutorialService";

// Record that the caller finished or closed a tour (or the What's new popup).
export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  if (!isTutorialKey(body.key)) {
    return NextResponse.json({ message: "Invalid tutorial key" }, { status: 400 });
  }

  await tutorialService.markSeen(session.user.id, body.key);
  return NextResponse.json({ success: true });
}

// "Replay all tutorials": forget which page tours the caller has seen.
export async function DELETE(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  await tutorialService.resetPageTours(session.user.id);
  return NextResponse.json({ success: true });
}
