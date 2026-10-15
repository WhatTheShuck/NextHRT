import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

// GET onboarding emails (queued or failed) whose compliance attachments are
// missing on disk, plus any currently-configured attachments that are missing
// (Admin only).
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const [emails, missingAttachments] = await Promise.all([
      onboardingConfigService.findStaleComplianceEmails(),
      onboardingConfigService.getMissingAttachments(),
    ]);
    return NextResponse.json({ emails, missingAttachments });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error checking onboarding emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST resend stale emails with the currently-uploaded compliance files
// (Admin only). Body: { jobIds?: number[] } — omit to resend all of them.
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      jobIds?: unknown;
    };
    const jobIds = Array.isArray(body.jobIds)
      ? body.jobIds.filter((id): id is number => Number.isInteger(id))
      : undefined;

    const result = await onboardingConfigService.resendStaleComplianceEmails(
      session.user.id,
      jobIds,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error resending onboarding emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
