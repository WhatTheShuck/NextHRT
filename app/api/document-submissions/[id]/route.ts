import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/api-auth";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";
import { actorOf, badRequest, errorResponse, fieldsFromForm, filesFromForm, readForm } from "@/lib/documentSubmissionHttp";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  try {
    return NextResponse.json(await documentSubmissionService.get(Number((await params).id), actorOf(session)));
  } catch (e) {
    return errorResponse(e);
  }
}

const removedSchema = z.array(z.number().int().positive());

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const fd = await readForm(request);
  if (fd instanceof NextResponse) return fd;
  const fields = fieldsFromForm(fd);
  if (!fields.success) return badRequest(fields.error.issues);
  let removedRaw: unknown;
  try {
    removedRaw = JSON.parse((fd.get("removedFileIds") as string) || "[]");
  } catch {
    return badRequest("removedFileIds must be a JSON array");
  }
  const removed = removedSchema.safeParse(removedRaw);
  if (!removed.success) return badRequest(removed.error.issues);
  try {
    const updated = await documentSubmissionService.resubmit(
      Number((await params).id), fields.data, filesFromForm(fd), removed.data, actorOf(session),
    );
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}
