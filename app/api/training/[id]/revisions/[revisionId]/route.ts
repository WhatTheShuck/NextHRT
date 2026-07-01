import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { trainingRevisionService } from "@/lib/services/trainingRevisionService";

async function requireTrainingUpdate(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
  const userRole = session.user.role as UserRole;
  const canEdit = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { training: ["edit"] } },
  });
  if (!canEdit.success) return { error: NextResponse.json({ message: "Not authorised" }, { status: 403 }) };
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const checked = await requireTrainingUpdate(request);
  if (checked.error) return checked.error;

  const { revisionId: revisionIdParam } = await params;
  const revisionId = parseInt(revisionIdParam);
  if (isNaN(revisionId)) {
    return NextResponse.json({ error: "Invalid revision ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await trainingRevisionService.updateRevision(
      revisionId,
      {
        revisionLabel: body.revisionLabel,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
        description: body.description,
        overrideRequiresRetraining: body.overrideRequiresRetraining,
      },
      checked.session!.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
      }
    }
    return NextResponse.json(
      { error: "Error updating revision", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const checked = await requireTrainingUpdate(request);
  if (checked.error) return checked.error;

  const { revisionId: revisionIdParam } = await params;
  const revisionId = parseInt(revisionIdParam);
  if (isNaN(revisionId)) {
    return NextResponse.json({ error: "Invalid revision ID" }, { status: 400 });
  }

  try {
    await trainingRevisionService.deleteRevision(revisionId, checked.session!.user.id);
    return NextResponse.json({ message: "Revision deleted" });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "REVISION_HAS_RECORDS":
          return NextResponse.json(
            { error: "Cannot delete a revision that has stamped training records" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      { error: "Error deleting revision", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
