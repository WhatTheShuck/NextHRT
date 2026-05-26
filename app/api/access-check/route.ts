import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { accessCheckService } from "@/lib/services/accessCheckService";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeIdParam = searchParams.get("employeeId");

  // Non-admins: can only query their own linked employee
  if (session.user.role !== "Admin") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { employeeId: true },
    });
    const linkedEmployeeId = dbUser?.employeeId ?? null;

    if (employeeIdParam !== null) {
      // Non-admin explicitly requested an employeeId — only allowed if it's their own
      const requested = parseInt(employeeIdParam, 10);
      if (isNaN(requested) || requested !== linkedEmployeeId) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    if (linkedEmployeeId === null) {
      return NextResponse.json({ linked: false }, { status: 200 });
    }

    try {
      const result = await accessCheckService.getUsersWithAccessToEmployee(linkedEmployeeId);
      return NextResponse.json({ linked: true, ...result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  // Admin: requires employeeId param
  if (!employeeIdParam) {
    return NextResponse.json(
      { message: "employeeId query parameter is required" },
      { status: 400 },
    );
  }

  const employeeId = parseInt(employeeIdParam, 10);
  if (isNaN(employeeId)) {
    return NextResponse.json({ message: "Invalid employeeId" }, { status: 400 });
  }

  try {
    const result = await accessCheckService.getUsersWithAccessToEmployee(employeeId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
