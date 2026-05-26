import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { trainingRequestService } from "@/lib/services/trainingRequestService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const trainingRequestId = parseInt(id, 10);
  if (isNaN(trainingRequestId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const detail = await trainingRequestService.getTrainingRequestDetails(trainingRequestId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only submitter or admin can view
    const isSubmitter = detail.approvalRequest.submittedByUserId === session.user.id;
    const isAdmin = session.user.role === "Admin";
    if (!isSubmitter && !isAdmin) {
      return NextResponse.json({ message: "Not authorised" }, { status: 403 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch training request" }, { status: 500 });
  }
}
