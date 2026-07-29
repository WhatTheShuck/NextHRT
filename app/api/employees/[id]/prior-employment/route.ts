import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { UserRole } from "@/generated/prisma_client/client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import prisma from "@/lib/prisma";
import { parsePriorStints } from "@/lib/employment";

// GET the archived prior employment stints for an employee (§2).
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
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  try {
    const hasAccess = await hasAccessToEmployee(userId, employeeId, userRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
      );
    }

    const rows = await prisma.history.findMany({
      where: {
        tableName: "Employee",
        recordId: String(employeeId),
        action: "REHIRE",
      },
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json(parsePriorStints(rows));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching prior employment",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
