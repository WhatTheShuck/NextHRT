import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, editsSchema, errorResponse, parseId, parseJsonBody } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return errorResponse(new Error("NOT_FOUND"));

  // Only an empty body means "approve as submitted"; a malformed one must not drop the edits.
  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("Expected a JSON body");
  const edits = editsSchema.safeParse(body.value);
  if (!edits.success) return badRequest(edits.error.issues);
  try {
    return NextResponse.json(await documentSubmissionService.approve(id, edits.data, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
