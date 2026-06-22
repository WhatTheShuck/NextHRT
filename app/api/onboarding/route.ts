import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { onboardingService } from "@/lib/services/onboardingService";
import { OnboardingStatus } from "@/generated/prisma_client/client";
import { mailService } from "@/lib/services/mailService";
import prisma from "@/lib/prisma";

const VALID_STATUSES: OnboardingStatus[] = [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
];

// GET list of onboarding requests (Admin-only review queue).
// Supports ?status=Pending|Approved|... and ?createdEmployeeId=N filters.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as OnboardingStatus)
      ? (statusParam as OnboardingStatus)
      : undefined;

  const createdEmployeeIdParam = searchParams.get("createdEmployeeId");
  const createdEmployeeId = createdEmployeeIdParam
    ? parseInt(createdEmployeeIdParam)
    : undefined;

  try {
    const requests = await onboardingService.listRequests({
      status,
      createdEmployeeId,
    });
    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching onboarding requests",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST a new onboarding request (any authenticated manager). Does NOT create an
// Employee — submitting persists a pending request for Admin review (§6.3).
export async function POST(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const created = await onboardingService.createRequest(
      json,
      session.user.id,
    );

    // Notify all admins — best-effort, never blocks or fails the submission.
    notifyAdmins(created, session.user.name ?? session.user.email, request.nextUrl.origin).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating onboarding request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function notifyAdmins(
  request: { id: number; legalFirstName: string; legalLastName: string },
  submittedBy: string,
  origin: string,
) {
  const admins = await prisma.user.findMany({
    where: { role: "Admin" },
    select: { email: true },
  });
  if (admins.length === 0) return;

  const candidateName = `${request.legalFirstName} ${request.legalLastName}`;
  const reviewUrl = `${origin}/admin/onboarding/${request.id}`;

  await mailService.send({
    to: admins.map((a) => a.email).filter((e): e is string => e !== null),
    subject: `New onboarding request: ${candidateName}`,
    html: `<p>${submittedBy} has submitted a new employee onboarding request for <strong>${candidateName}</strong>.</p><p><a href="${reviewUrl}">Review the request</a></p>`,
    text: `${submittedBy} has submitted a new employee onboarding request for ${candidateName}.\n\nReview: ${reviewUrl}`,
  });
}
