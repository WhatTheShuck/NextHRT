import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// PUT - Link/update user to employee
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

  const userRole = session.user.role as UserRole;
  const { id: targetUserId } = await params;

  // Only Admins can manage user-employee mappings
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const { employeeId } = json;

    // Get the current user for history tracking
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employee: true },
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // If employeeId is provided, check if employee exists and isn't already linked
    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return NextResponse.json(
          { message: "Employee not found" },
          { status: 404 },
        );
      }

      // Check if employee is already linked to another user
      const existingUserLink = await prisma.user.findFirst({
        where: {
          employeeId: employeeId,
          id: { not: targetUserId }, // Exclude current user
        },
      });

      if (existingUserLink) {
        return NextResponse.json(
          {
            message: "Employee is already linked to another user",
          },
          { status: 409 },
        );
      }
    }

    // Update the user with new employee link
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        employeeId: employeeId || null,
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
        managedDepartments: true,
      },
    });

    // Create history record
    const oldValues = {
      employeeId: currentUser.employeeId,
    };
    const newValues = {
      employeeId: updatedUser.employeeId,
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: targetUserId,
        action: "UPDATE",
        changedFields: JSON.stringify(["employeeId"]),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId: session.user.id,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating user-employee mapping",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE - Unlink user from employee
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

  const userRole = session.user.role as UserRole;
  const { id: targetUserId } = await params;

  // Only Admins can manage user-employee mappings
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    // Get the current user for history tracking
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employee: true },
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (!currentUser.employeeId) {
      return NextResponse.json(
        {
          message: "User is not linked to any employee",
        },
        { status: 400 },
      );
    }

    // Remove the employee link
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        employeeId: null,
      },
      include: {
        employee: true,
        managedDepartments: true,
      },
    });

    // Create history record
    const oldValues = {
      employeeId: currentUser.employeeId,
    };
    const newValues = {
      employeeId: null,
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: targetUserId,
        action: "UPDATE",
        changedFields: JSON.stringify(["employeeId"]),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId: session.user.id,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error removing user-employee mapping",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
