import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client/client";
import { userService } from "@/lib/services/userService";

// GET all users
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const includeEmployee = url.searchParams.get("includeEmployee") === "true";
    const userRole = session.user.role as UserRole;

    const users = await userService.getUsers({ includeEmployee, userRole });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching users",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
