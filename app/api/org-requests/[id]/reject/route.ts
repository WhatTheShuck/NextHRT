import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { orgRequestService } from "@/lib/services/orgRequestService";
import { UserRole } from "@/generated/prisma_client/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if ((session.user.role as UserRole) !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;
  const orgRequestId = parseInt(id);
  if (isNaN(orgRequestId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    const { note } = await request.json().catch(() => ({ note: undefined }));
    const result = await orgRequestService.rejectRequest(orgRequestId, session.user.id, note);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORG_REQUEST_NOT_FOUND") {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
      }
      if (error.message === "ORG_REQUEST_NOT_PENDING") {
        return NextResponse.json({ message: "Request is not pending" }, { status: 409 });
      }
    }
    return NextResponse.json(
      { error: "Failed to reject org request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
