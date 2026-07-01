import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingService } from "@/lib/services/onboardingService";

// POST reject an onboarding request (Admin-only). No Employee is created. The
// optional body may carry { reviewNotes } explaining the rejection.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  let reviewNotes: string | null = null;
  try {
    const body = await request.json();
    reviewNotes = body?.reviewNotes ?? null;
  } catch {
    reviewNotes = null;
  }

  try {
    const result = await onboardingService.rejectRequest(
      parseInt(id),
      session.user.id,
      reviewNotes,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "ONBOARDING_REQUEST_NOT_FOUND":
          return NextResponse.json(
            { error: "Onboarding request not found" },
            { status: 404 },
          );
        case "ONBOARDING_REQUEST_NOT_PENDING":
          return NextResponse.json(
            { error: "Only pending requests can be rejected" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error rejecting onboarding request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
