import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { userService } from "@/lib/services/userService";

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

  const canList = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { user: ["list"] } },
  });

  // Users can only view their own departments unless they have list permission (Admin)
  if (!canList && currentUserId !== targetUserId) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const departments = await userService.getManagedDepartments(targetUserId);
    return NextResponse.json(departments);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
      }
    }
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

  const canSetRole = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { user: ["set-role"] } },
  });

  if (!canSetRole) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const { departmentIds } = json;

    const departments = await userService.updateManagedDepartments(
      targetUserId,
      departmentIds,
      session.user.id,
    );
    return NextResponse.json(departments);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "DEPARTMENTS_NOT_FOUND":
          return NextResponse.json(
            { message: "One or more departments not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating user departments",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
