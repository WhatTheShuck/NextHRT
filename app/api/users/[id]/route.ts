import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET specific user
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = request.auth.user?.role as UserRole;
  const currentUserId = request.auth.user?.id;
  const params = await props.params;
  const targetUserId = params.id;

  // Users can only view themselves unless they're Admin
  if (userRole !== "Admin" && currentUserId !== targetUserId) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
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

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PATCH update user (role, managed departments, etc.)
export const PATCH = auth(async function PATCH(
  req,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;
  const params = await props.params;
  const targetUserId = params.id;

  // Only Admins can update user roles and permissions
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await req.json();

    // Get the current user for history tracking
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { managedDepartments: true },
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    if (json.role !== undefined) {
      updateData.role = json.role;
    }

    // Handle managed departments for Department Managers
    if (json.managedDepartmentIds !== undefined) {
      updateData.managedDepartments = {
        set: json.managedDepartmentIds.map((id: number) => ({ id })),
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
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
    const changedFields = Object.keys(json);
    const oldValues = {
      role: currentUser.role,
      managedDepartments: currentUser.managedDepartments.map((d) => d.id),
    };
    const newValues = {
      role: updatedUser.role,
      managedDepartments: updatedUser.managedDepartments.map((d) => d.id),
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: targetUserId, // Note: User ID is string, but History expects Int
        action: "UPDATE",
        changedFields: JSON.stringify(changedFields),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE user
export const DELETE = auth(async function DELETE(
  req,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;
  const currentUserId = req.auth.user?.id;
  const params = await props.params;
  const targetUserId = params.id;

  // Only Admins can delete users, and they can't delete themselves
  if (userRole !== "Admin" || currentUserId === targetUserId) {
    return NextResponse.json(
      {
        message:
          currentUserId === targetUserId
            ? "Cannot delete your own account"
            : "Not authorised",
      },
      { status: 403 },
    );
  }

  try {
    // Get user before deletion for history
    const userToDelete = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { managedDepartments: true },
    });

    if (!userToDelete) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Delete the user (this will cascade to related records due to schema)
    await prisma.user.delete({
      where: { id: targetUserId },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: targetUserId,
        action: "DELETE",
        oldValues: JSON.stringify(userToDelete),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
