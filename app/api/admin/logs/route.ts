import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logService } from "@/lib/services/logService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const severity = searchParams.get("severity") as "Info" | "Warning" | "Error" | null;

  try {
    const logs = await logService.getLogs({ severity: severity ?? undefined, limit: 500 });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
