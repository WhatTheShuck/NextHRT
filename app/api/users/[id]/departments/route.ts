import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET user's managed departments
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

  const userRole = session.user.role as UserRole;
  const currentUserId = session.user.id;
  const { id: targetUserId } = await params;

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
}

// PUT update user's managed departments
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

  // Only Admins can update managed departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
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
        userId: session.user.id,
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
}
