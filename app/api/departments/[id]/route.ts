import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET single department
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const userRole = request.auth.user?.role as UserRole;

  try {
    const id = parseInt(params.id);
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            location: {
              select: {
                name: true,
                state: true,
              },
            },
          },
          where: activeOnly
            ? {
                isActive: true,
              }
            : undefined,
        },
        _count: {
          select: { employees: true },
        },
        managers:
          userRole === "Admin"
            ? {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              }
            : false,
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(department);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update department
export const PUT = auth(async function PUT(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can update departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    // Get current department data for history
    const currentDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!currentDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    const json = await request.json();
    // Check for duplicate based on unique constraint
    const existingRecord = await prisma.department.findFirst({
      where: {
        name: json.name,
        id: { not: id },
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          error: "Duplicate record found",
          code: "DUPLICATE_DEPARTMENT",
          message: "A department with this name already exists",
        },
        { status: 409 },
      );
    }
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name: json.name,
        isActive: json.isActive,
        parentDepartmentId: json.parentDepartmentId || null,
        level: json.parentDepartmentId ? 1 : 0,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Department",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentDepartment),
        newValues: JSON.stringify(updatedDepartment),
        userId: userId,
      },
    });

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE department
export const DELETE = auth(async function DELETE(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can delete departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const id = parseInt(params.id);

    // Check if there are employees in this department
    const employeeCount = await prisma.employee.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete department with active employees" },
        { status: 400 },
      );
    }

    // Get current department data for history
    const currentDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!currentDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    // Delete department
    await prisma.$transaction([
      // Create history record
      prisma.history.create({
        data: {
          tableName: "Department",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentDepartment),
          userId: userId,
        },
      }),
      // Delete the department
      prisma.department.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ message: "Department deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
