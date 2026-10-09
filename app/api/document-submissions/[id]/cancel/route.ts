import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, errorResponse, parseId } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return errorResponse(new Error("NOT_FOUND"));
  try {
    return NextResponse.json(await documentSubmissionService.cancel(id, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
