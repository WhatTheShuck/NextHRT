import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { userService } from "@/lib/services/userService";

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

  const canManage = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { user: ["set-role"] } },
  });

  if (!canManage) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const { employeeId } = json;

    const updatedUser = await userService.linkEmployee(
      targetUserId,
      employeeId,
      session.user.id,
    );
    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "EMPLOYEE_NOT_FOUND":
          return NextResponse.json(
            { message: "Employee not found" },
            { status: 404 },
          );
        case "EMPLOYEE_ALREADY_LINKED":
          return NextResponse.json(
            { message: "Employee is already linked to another user" },
            { status: 409 },
          );
      }
    }
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

  const canManage = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { user: ["set-role"] } },
  });

  if (!canManage) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const updatedUser = await userService.unlinkEmployee(
      targetUserId,
      session.user.id,
    );
    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "User not found" },
            { status: 404 },
          );
        case "NO_EMPLOYEE_LINKED":
          return NextResponse.json(
            { message: "User is not linked to any employee" },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error removing user-employee mapping",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
