import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { accessCheckService } from "@/lib/services/accessCheckService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const idParam = searchParams.get("id");
  const activeOnlyParam = searchParams.get("activeOnly");
  const activeOnly = activeOnlyParam !== "false";

  try {
    if (scope === "all") {
      const result = await accessCheckService.getAllEmployeesWithAccessors(activeOnly);
      return NextResponse.json(result);
    }

    if (scope === "department") {
      if (!idParam) {
        return NextResponse.json({ message: "id is required for scope=department" }, { status: 400 });
      }
      const departmentId = parseInt(idParam, 10);
      if (isNaN(departmentId)) {
        return NextResponse.json({ message: "Invalid id" }, { status: 400 });
      }
      const result = await accessCheckService.getDepartmentEmployeesWithAccessors(departmentId);
      return NextResponse.json(result);
    }

    if (scope === "location") {
      if (!idParam) {
        return NextResponse.json({ message: "id is required for scope=location" }, { status: 400 });
      }
      const locationId = parseInt(idParam, 10);
      if (isNaN(locationId)) {
        return NextResponse.json({ message: "Invalid id" }, { status: 400 });
      }
      const result = await accessCheckService.getLocationEmployeesWithAccessors(locationId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { message: "scope must be one of: all, department, location" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
