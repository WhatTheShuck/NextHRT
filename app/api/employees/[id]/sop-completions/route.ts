import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import { sopAssessmentService } from "@/lib/services/sopAssessmentService";

// GET → SOPs this employee completed in HRT, so the profile SOP tab knows
// which rows have a digital completion record behind them. Paper-era
// completions are absent by design.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const employeeId = parseInt(id);
  if (isNaN(employeeId)) {
    return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
  }

  const hasAccess = await hasAccessToEmployee(
    session.user.id,
    employeeId,
    session.user.role as UserRole,
  );
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Not authorised to view this employee" },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json(
      await sopAssessmentService.listCompletedForEmployee(employeeId),
    );
  } catch {
    return NextResponse.json(
      { error: "Error listing SOP completions" },
      { status: 500 },
    );
  }
}
