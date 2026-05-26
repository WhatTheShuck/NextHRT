import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trainingRequestService } from "@/lib/services/trainingRequestService";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      employeeId,
      trainingId,
      trainingCourseRequestId,
      nominatedApproverEmployeeId,
      justification,
      cost,
      hours,
      trainingDate,
      intendedCompletionDate,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const result = await trainingRequestService.createTrainingRequest({
      employeeId: Number(employeeId),
      submittedByUserId: session.user.id,
      trainingId: trainingId ? Number(trainingId) : null,
      trainingCourseRequestId: trainingCourseRequestId ? Number(trainingCourseRequestId) : null,
      nominatedApproverEmployeeId: nominatedApproverEmployeeId
        ? Number(nominatedApproverEmployeeId)
        : undefined,
      justification,
      cost: cost != null ? Number(cost) : undefined,
      hours: hours != null ? Number(hours) : undefined,
      trainingDate: trainingDate ? new Date(trainingDate) : undefined,
      intendedCompletionDate: intendedCompletionDate ? new Date(intendedCompletionDate) : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REQUEST") {
      return NextResponse.json({ error: "Must provide trainingId or trainingCourseRequestId" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create training request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    // Look up the user's linked employee so we can return requests submitted for them too.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { employeeId: true },
    });

    const requests = await trainingRequestService.getRequestsForUser(
      session.user.id,
      user?.employeeId ?? undefined,
    );
    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch training requests" }, { status: 500 });
  }
}
