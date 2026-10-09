import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, errorResponse, sendBackSchema } from "@/lib/documentSubmissionHttp";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const body = sendBackSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return badRequest(body.error.issues);
  try {
    return NextResponse.json(await documentSubmissionService.sendBack(Number((await params).id), body.data.reason, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}
