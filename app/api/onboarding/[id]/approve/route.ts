import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingService } from "@/lib/services/onboardingService";
import { onboardingFanOutService } from "@/lib/services/onboardingFanOutService";

// POST approve an onboarding request (Admin-only). Creates the Employee (no
// User) in a transaction and flips the request to Approved. The optional body
// may carry Admin edits to the core HR fields (the data-integrity gate, §6.3).
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

  let edits;
  try {
    edits = await request.json();
  } catch {
    edits = undefined; // empty body = approve as-submitted
  }

  try {
    const result = await onboardingService.approveRequest(
      parseInt(id),
      session.user.id,
      edits,
    );

    // Enqueue all downstream jobs (Wave E / §7). Errors are logged per-section
    // but do NOT fail the response — the Employee is created regardless.
    onboardingFanOutService.enqueueAll(result.request, result.employee).catch((err) => {
      console.error("[onboarding-fan-out] Unexpected error:", err);
    });

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
            { error: "Only pending requests can be approved" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error approving onboarding request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
