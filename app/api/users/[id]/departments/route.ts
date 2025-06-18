import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET user's managed departments
export const GET = auth(async function GET(
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

  // Users can only view their own departments unless they're Admin
  if (userRole !== "Admin" && currentUserId !== targetUserId) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        managedDepartments: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user.managedDepartments);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching user departments",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update user's managed departments
export const PUT = auth(async function PUT(
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

  // Only Admins can update managed departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const { departmentIds } = json;

    // Get the current user for history tracking
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { managedDepartments: true },
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Validate that all department IDs exist
    if (departmentIds && departmentIds.length > 0) {
      const existingDepartments = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
      });

      if (existingDepartments.length !== departmentIds.length) {
        return NextResponse.json(
          {
            message: "One or more departments not found",
          },
          { status: 404 },
        );
      }
    }

    // Update the user's managed departments
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        managedDepartments: {
          set: departmentIds ? departmentIds.map((id: number) => ({ id })) : [],
        },
      },
      include: {
        managedDepartments: true,
      },
    });

    // Create history record
    const oldValues = {
      managedDepartments: currentUser.managedDepartments.map((d) => d.id),
    };
    const newValues = {
      managedDepartments: updatedUser.managedDepartments.map((d) => d.id),
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: targetUserId,
        action: "UPDATE",
        changedFields: JSON.stringify(["managedDepartments"]),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(updatedUser.managedDepartments);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating user departments",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
