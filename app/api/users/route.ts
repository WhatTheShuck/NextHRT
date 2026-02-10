import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all users
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  // Only Admins can view all users
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const includeEmployee = url.searchParams.get("includeEmployee") === "true";

    const users = await prisma.user.findMany({
      include: {
        employee: includeEmployee
          ? {
              include: {
                department: true,
                location: true,
              },
            }
          : false,
        managedDepartments: true,
      },
      orderBy: {
        name: "asc",
      },
    });

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
