import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { approvalService } from "@/lib/services/approvalService";
import { trainingRequestService } from "@/lib/services/trainingRequestService";
import prisma from "@/lib/prisma";

export async function POST(
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
    const body = await request.json();
    const { decision, comment } = body as { decision: "Approved" | "Rejected"; comment?: string };

    if (!decision || !["Approved", "Rejected"].includes(decision)) {
      return NextResponse.json({ error: "decision must be Approved or Rejected" }, { status: 400 });
    }

    // Resolve the approval request ID from the training request.
    const trainingRequest = await prisma.trainingRequest.findUnique({
      where: { id: trainingRequestId },
      select: { approvalRequestId: true },
    });
    if (!trainingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await approvalService.recordDecision({
      requestId: trainingRequest.approvalRequestId,
      userId: session.user.id,
      decision,
      comment,
    });

    // If Admin-stage approval → create TrainingRecord.
    if (updated?.status === "Approved") {
      await trainingRequestService.finaliseApproval(trainingRequestId);
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "COMMENT_REQUIRED":
          return NextResponse.json({ error: "A comment is required for this action" }, { status: 400 });
        case "REQUEST_NOT_FOUND":
          return NextResponse.json({ error: "Request not found" }, { status: 404 });
        case "REQUEST_NOT_PENDING":
          return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
        case "COURSE_REQUEST_UNRESOLVED":
          return NextResponse.json(
            { error: "The training course for this request has not yet been approved by an admin" },
            { status: 422 },
          );
      }
    }
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
