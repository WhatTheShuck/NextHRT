import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { userService } from "@/lib/services/userService";

// GET specific user
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

  // Users can only view themselves unless they have list permission (Admin)
  if (!canList && currentUserId !== targetUserId) {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const user = await userService.getUserById(targetUserId);
    return NextResponse.json(user);
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
        error: "Error fetching user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// PATCH update user (role, managed departments, etc.)
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
    const updatedUser = await userService.updateUser(
      targetUserId,
      json,
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
      }
    }
    return NextResponse.json(
      {
        error: "Error updating user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE user
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
  const currentUserId = session.user.id;
  const { id: targetUserId } = await params;

  const canDelete = await auth.api.userHasPermission({
    body: { role: userRole, permissions: { user: ["delete"] } },
  });

  if (!canDelete || currentUserId === targetUserId) {
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
    const result = await userService.deleteUser(targetUserId, session.user.id);
    return NextResponse.json(result);
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
        error: "Error deleting user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
