import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, errorResponse, fieldsFromForm, filesFromForm, readForm } from "@/lib/documentSubmissionHttp";
import type { DocumentSubmissionStatus } from "@/generated/prisma_client/client";

const STATUSES = ["Pending", "ChangesRequested", "Approved", "Cancelled"];

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const parsed = sp.get("status")?.split(",").filter((s) => STATUSES.includes(s)) as DocumentSubmissionStatus[] | undefined;
  // An empty list (no valid statuses given) means no filter, not "match nothing".
  const status = parsed && parsed.length > 0 ? parsed : undefined;
  const employeeId = Number(sp.get("employeeId")) || undefined;
  try {
    return NextResponse.json(await documentSubmissionService.list({ status, employeeId }, actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const fd = await readForm(request);
  if (fd instanceof NextResponse) return fd;
  const fields = fieldsFromForm(fd);
  if (!fields.success) return badRequest(fields.error.issues);
  try {
    const created = await documentSubmissionService.submit(fields.data, filesFromForm(fd), actorOf(session));
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
