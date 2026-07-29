import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { sopService } from "@/lib/services/sopService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;
  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid training ID" }, { status: 400 });
  }

  try {
    return NextResponse.json(await sopService.listTrainers(id));
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json({ error: "Training not found" }, { status: 404 });
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "ASSESSMENT_NOT_FOUND":
          return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        case "NOT_AUTHORISED":
          return NextResponse.json({ error: "Not authorised" }, { status: 403 });
        case "NOT_A_TASK_SHEET":
        case "NOT_AN_SOP_PAIR":
        case "INVALID_FILE_TYPE":
        case "FILE_TOO_LARGE":
        case "INVALID_QUESTION":
        case "INVALID_ANSWER":
        case "ANSWER_LOCKED":
        case "INVALID_STATE":
        case "INCOMPLETE_ANSWERS":
        case "MISSING_VERDICTS":
        case "VERDICT_MISMATCH":
        case "SOP_NOT_READY":
        case "NO_LINKED_EMPLOYEE":
          return NextResponse.json({ error: error.message }, { status: 400 });
        case "QUESTION_IN_USE": {
          const count = (error as Error & { count?: number }).count ?? 0;
          return NextResponse.json(
            { error: `In use by ${count} assessment(s) — the question can't be deleted.` },
            { status: 400 },
          );
        }
      }
    }
    return NextResponse.json({ error: "Error listing trainers" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;
  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid training ID" }, { status: 400 });
  }

  try {
    const body = await request.json(); // { employeeIds: number[] }
    return NextResponse.json(
      await sopService.setTrainers(id, body.employeeIds, session.user.id),
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json({ error: "Training not found" }, { status: 404 });
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "ASSESSMENT_NOT_FOUND":
          return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        case "NOT_AUTHORISED":
          return NextResponse.json({ error: "Not authorised" }, { status: 403 });
        case "NOT_A_TASK_SHEET":
        case "NOT_AN_SOP_PAIR":
        case "INVALID_FILE_TYPE":
        case "FILE_TOO_LARGE":
        case "INVALID_QUESTION":
        case "INVALID_ANSWER":
        case "ANSWER_LOCKED":
        case "INVALID_STATE":
        case "INCOMPLETE_ANSWERS":
        case "MISSING_VERDICTS":
        case "VERDICT_MISMATCH":
        case "SOP_NOT_READY":
        case "NO_LINKED_EMPLOYEE":
          return NextResponse.json({ error: error.message }, { status: 400 });
        case "QUESTION_IN_USE": {
          const count = (error as Error & { count?: number }).count ?? 0;
          return NextResponse.json(
            { error: `In use by ${count} assessment(s) — the question can't be deleted.` },
            { status: 400 },
          );
        }
      }
    }
    return NextResponse.json({ error: "Error saving trainers" }, { status: 500 });
  }
}
