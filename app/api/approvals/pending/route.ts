import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { approvalService } from "@/lib/services/approvalService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const pending = await approvalService.getPendingRequestsForUser(session.user.id);
    return NextResponse.json(pending);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch pending approvals" }, { status: 500 });
  }
}
