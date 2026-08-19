import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { sopService } from "@/lib/services/sopService";

// PUT pair-wide details. `id` is the Task Sheet training id — the pair's key.
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
    return NextResponse.json({ error: "Invalid SOP ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await sopService.updatePair(
      id,
      {
        title: body.title,
        isActive: body.isActive ?? true,
        requiresRetrainingOnRevision: body.requiresRetrainingOnRevision ?? false,
        requirements: body.requirements,
      },
      session.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TRAINING_NOT_FOUND":
        case "SOP_NOT_FOUND":
          return NextResponse.json({ error: "SOP not found" }, { status: 404 });
        case "NOT_AN_SOP_PAIR":
          return NextResponse.json(
            {
              error:
                "This SOP is not linked to a Practical half — repair the pair before editing it.",
            },
            { status: 400 },
          );
        case "NOT_A_TASK_SHEET":
          return NextResponse.json(
            { error: "SOPs must be edited from their Task Sheet half" },
            { status: 400 },
          );
        case "TITLE_REQUIRED":
          return NextResponse.json({ error: "SOP name is required" }, { status: 400 });
      }
    }
    return NextResponse.json(
      {
        error: "Error updating SOP",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
