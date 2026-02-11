import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { departmentService } from "@/lib/services/departmentService";

// GET single department
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
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const userRole = session.user.role as UserRole;

  try {
    const departmentId = parseInt(id);
    const department = await departmentService.getDepartmentById(departmentId, {
      activeOnly,
      userRole,
    });
    return NextResponse.json(department);
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
        error: "Error fetching department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PUT update department
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
  const userRole = session.user.role as UserRole;

  // Only Admins can update departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const departmentId = parseInt(id);
    const json = await request.json();
    const updatedDepartment = await departmentService.updateDepartment(
      departmentId,
      json,
      session.user.id,
    );
    return NextResponse.json(updatedDepartment);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DEPARTMENT_NOT_FOUND":
          return NextResponse.json(
            { error: "Department not found" },
            { status: 404 },
          );
        case "DUPLICATE_DEPARTMENT":
          return NextResponse.json(
            {
              error: "Duplicate record found",
              code: "DUPLICATE_DEPARTMENT",
              message: "A department with this name already exists",
            },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE department
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
  const userRole = session.user.role as UserRole;

  // Only Admins can delete departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const departmentId = parseInt(id);
    const result = await departmentService.deleteDepartment(
      departmentId,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DEPARTMENT_NOT_FOUND":
          return NextResponse.json(
            { error: "Department not found" },
            { status: 404 },
          );
        case "DEPARTMENT_HAS_EMPLOYEES":
          return NextResponse.json(
            { error: "Cannot delete department with active employees" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
