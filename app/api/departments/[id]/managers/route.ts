import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import { departmentService } from "@/lib/services/departmentService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const departmentId = parseInt(id, 10);

  if (isNaN(departmentId)) {
    return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
  }

  try {
    const managers = await departmentService.getDepartmentManagers(departmentId);
    return NextResponse.json(managers);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DEPARTMENT_NOT_FOUND":
          return NextResponse.json(
            { error: "Department not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching department managers",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
