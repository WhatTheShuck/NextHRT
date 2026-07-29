import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { sopPdfService } from "@/lib/services/sopPdfService";

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
  const revisionId = parseInt(request.nextUrl.searchParams.get("revisionId") ?? "");
  if (isNaN(id) || isNaN(revisionId)) {
    return NextResponse.json(
      { error: "Invalid training or revision ID" },
      { status: 400 },
    );
  }

  try {
    const bytes = await sopPdfService.assemble(id, revisionId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sop-${id}-rev-${revisionId}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_A_TASK_SHEET":
          return NextResponse.json({ error: error.message }, { status: 400 });
        case "REVISION_NOT_FOUND":
          return NextResponse.json({ error: "Revision not found" }, { status: 404 });
        case "SOP_NOT_READY":
          return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Error assembling SOP PDF" }, { status: 500 });
  }
}
