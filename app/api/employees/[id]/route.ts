import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { employeeService } from "@/lib/services/employeeService";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

// GET single employee
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
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(id);
  const { searchParams } = new URL(request.url);
  const includeExemptions = searchParams.get("includeExemptions") === "true";

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee" },
        { status: 403 },
      );
    }

    const employee = await employeeService.getEmployeeById(
      employeeId,
      includeExemptions,
    );

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "Error fetching employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH partial update employee
export async function PATCH(
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
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to update this employee" },
        { status: 403 },
      );
    }

    const json = await request.json();
    const updatedEmployee = await employeeService.updateEmployeePartial(
      employeeId,
      json,
      userId,
    );

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "Error updating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT full update employee
export async function PUT(
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
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to update this employee" },
        { status: 403 },
      );
    }

    const json = await request.json();
    const updatedEmployee = await employeeService.updateEmployeeFull(
      employeeId,
      json,
      userId,
    );

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "Error updating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE employee
export async function DELETE(
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
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(id);

  // Only Admins can delete employees
  if (userRole !== "Admin") {
    return NextResponse.json(
      { error: "Only administrators can delete employees" },
      { status: 403 },
    );
  }

  try {
    const result = await employeeService.deleteEmployee(employeeId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "Error deleting employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
