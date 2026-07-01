import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingService } from "@/lib/services/onboardingService";

// GET a single onboarding request (Admin-only)
export async function GET(
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

  try {
    const onboardingRequest = await onboardingService.getRequestById(
      parseInt(id),
    );
    return NextResponse.json(onboardingRequest);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ONBOARDING_REQUEST_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Onboarding request not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: "Error fetching onboarding request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
