import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const trainingRequestId = parseInt(id, 10);
  if (isNaN(trainingRequestId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const tr = await prisma.trainingRequest.findUnique({
      where: { id: trainingRequestId },
      include: { approvalRequest: true },
    });

    if (!tr) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (tr.approvalRequest.submittedByUserId !== session.user.id) {
      return NextResponse.json({ message: "Not authorised" }, { status: 403 });
    }
    if (tr.approvalRequest.status !== "Pending") {
      return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 409 });
    }

    await prisma.approvalRequest.update({
      where: { id: tr.approvalRequestId },
      data: { status: "Cancelled" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to cancel request" }, { status: 500 });
  }
}
