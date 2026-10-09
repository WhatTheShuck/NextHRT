import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, editsSchema, errorResponse } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const edits = editsSchema.safeParse(await request.json().catch(() => ({})));
  if (!edits.success) return badRequest(edits.error.issues);
  try {
    return NextResponse.json(await documentSubmissionService.approve(Number((await params).id), edits.data, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
