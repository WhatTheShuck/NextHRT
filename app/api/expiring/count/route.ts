import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentStatusService } from "@/lib/services/documentStatusService";
import { actorOf, errorResponse } from "@/lib/documentSubmissionHttp";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  try {
    return NextResponse.json({ count: await documentStatusService.count(actorOf(session)) });
  } catch (e) {
    return errorResponse(e);
  }
}
