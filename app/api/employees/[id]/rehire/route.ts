import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { employeeService } from "@/lib/services/employeeService";

// Keys the server owns — the archive snapshot is built server-side (§3, §7.4),
// so a client that tries to supply one is rejected outright.
const FORBIDDEN_BODY_KEYS = ["oldValues", "newValues", "changedFields"];

// POST rehire a departed employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json(
      { error: "Only administrators can rehire employees" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const employeeId = parseInt(id);

  if (Number.isNaN(employeeId)) {
    return NextResponse.json(
      { error: "Invalid employee id" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();

    // The server builds the archive; reject any client-supplied snapshot.
    const forbidden = FORBIDDEN_BODY_KEYS.filter((key) => key in body);
    if (forbidden.length > 0) {
      return NextResponse.json(
        {
          error: `Request may not include server-owned fields: ${forbidden.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const updatedEmployee = await employeeService.rehireEmployee(
      employeeId,
      body,
      session.user.id,
    );

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (
      message === "ACTIVE_EMPLOYEE" ||
      message === "MISSING_FINISH_DATE" ||
      message === "INVALID_REHIRE_DATE"
    ) {
      const detail: Record<string, string> = {
        ACTIVE_EMPLOYEE: "This employee is already active and cannot be rehired.",
        MISSING_FINISH_DATE:
          "A prior finish date is required because the record has no finish date.",
        INVALID_REHIRE_DATE:
          "The rehire start date must be after the prior finish date.",
      };
      return NextResponse.json(
        { error: detail[message], code: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Error rehiring employee", details: message },
      { status: 500 },
    );
  }
}
