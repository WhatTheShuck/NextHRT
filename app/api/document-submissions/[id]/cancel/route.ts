import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, errorResponse } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  try {
    return NextResponse.json(await documentSubmissionService.cancel(Number((await params).id), actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
