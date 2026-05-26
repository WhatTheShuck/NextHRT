import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trainingCourseRequestService } from "@/lib/services/trainingCourseRequestService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;
  const courseRequestId = parseInt(id, 10);
  if (isNaN(courseRequestId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const { decision, trainingData } = await request.json();
    if (!decision || !["Approved", "Rejected"].includes(decision)) {
      return NextResponse.json({ error: "decision must be Approved or Rejected" }, { status: 400 });
    }

    const result = await trainingCourseRequestService.resolveCourseRequest(
      courseRequestId,
      decision,
      trainingData,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Course request not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TRAINING_DATA_REQUIRED") {
      return NextResponse.json({ error: "trainingData is required when approving" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to resolve course request" }, { status: 500 });
  }
}
