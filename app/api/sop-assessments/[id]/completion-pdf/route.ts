import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import { sopAssessmentService } from "@/lib/services/sopAssessmentService";
import { renderCompletionRecord } from "@/lib/services/sopPdfService";

// GET → proof-of-completion PDF for one HRT-completed SOP: questions, answers,
// verdicts, the employee's acknowledgement and the trainer sign-off.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const assessmentId = parseInt(id);
  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: "Invalid assessment ID" }, { status: 400 });
  }

  try {
    // The evidence carries the employee, so authorise on it before rendering.
    const evidence = await sopAssessmentService.getCompletionEvidence(assessmentId);

    const hasAccess = await hasAccessToEmployee(
      session.user.id,
      evidence.employeeId,
      session.user.role as UserRole,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const bytes = await renderCompletionRecord(evidence);
    const slug = evidence.sopTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sop-completion-${slug}-${assessmentId}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "ASSESSMENT_NOT_FOUND":
          return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
        case "NOT_COMPLETED":
          return NextResponse.json(
            { error: "This SOP has no completed HRT assessment" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      { error: "Error building completion record" },
      { status: 500 },
    );
  }
}
