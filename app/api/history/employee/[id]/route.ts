import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccessToEmployee } from "@/lib/apiRBAC";
import { historyService } from "@/lib/services/historyService";

// GET history records for a specific employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const employeeId = parseInt(id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee's history" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    const result = await historyService.getEmployeeHistory({
      employeeId,
      action: searchParams.get("action"),
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : null,
      includeOrphaned: searchParams.get("includeOrphaned") === "true",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            { error: "Employee not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching employee history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
