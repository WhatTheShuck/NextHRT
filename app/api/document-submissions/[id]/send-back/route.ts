import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, errorResponse, parseId, parseJsonBody, sendBackSchema } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return errorResponse(new Error("NOT_FOUND"));

  const json = await parseJsonBody(request);
  if (!json.ok) return badRequest("Expected a JSON body");
  const body = sendBackSchema.safeParse(json.value);
  if (!body.success) return badRequest(body.error.issues);
  try {
    return NextResponse.json(await documentSubmissionService.sendBack(id, body.data.reason, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
