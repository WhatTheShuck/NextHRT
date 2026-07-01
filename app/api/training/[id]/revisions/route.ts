import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { trainingRevisionService } from "@/lib/services/trainingRevisionService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid training ID" }, { status: 400 });
  }

  const revisions = await trainingRevisionService.listForTraining(id);
  return NextResponse.json(revisions);
}

export async function POST(
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
    const body = await request.json();
    const revision = await trainingRevisionService.createRevision(
      {
        trainingId: id,
        revisionLabel: body.revisionLabel,
        effectiveDate: new Date(body.effectiveDate),
        description: body.description,
        overrideRequiresRetraining: body.overrideRequiresRetraining,
      },
      session.user.id,
    );
    return NextResponse.json(revision, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
          return NextResponse.json({ error: "Training not found" }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: "Error creating revision", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
