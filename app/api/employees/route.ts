import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { employeeService } from "@/lib/services/employeeService";
import { getCurrentUser } from "@/lib/apiRBAC";

// GET all employees
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const reportType = searchParams.get("reportType");
  const startedFrom = searchParams.get("startedFrom");
  const startedTo = searchParams.get("startedTo");
  const filterByUserId = searchParams.get("userId");
  const userRole = session.user.role as UserRole;
  const userId = session.user.id;

  try {
    const employees = await employeeService.getEmployees({
      activeOnly,
      reportType,
      startedFrom,
      startedTo,
      userRole,
      userId,
      filterByUserId,
    });

    return NextResponse.json(employees);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NO_EMPLOYEE_VIEWER_ACCESS":
          return NextResponse.json(
            { message: "No Employee Viewer access to run this report" },
            { status: 403 },
          );
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "NO_EMPLOYEE_RECORD":
          return NextResponse.json(
            { message: "No associated employee record" },
            { status: 403 },
          );
      }
    }

    return NextResponse.json(
      {
        error: "Error fetching employees",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new employee
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const user = await getCurrentUser();

  if (!user || user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const employee = await employeeService.createEmployee(
      json,
      session.user.id,
    );
    return NextResponse.json(employee);
  } catch (error: any) {
    // Handle duplicate employee error
    if (error?.code === "DUPLICATE_EMPLOYEE") {
      return NextResponse.json(
        {
          error: "Potential duplicate employee found",
          code: "DUPLICATE_EMPLOYEE",
          matches: error.matches,
          suggestions: error.suggestions,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Error creating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
