import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { departmentService } from "@/lib/services/departmentService";

// GET all departments
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeHidden = searchParams.get("includeHidden") === "true";
  const userRole = session.user.role as UserRole;

  try {
    const departments = await departmentService.getDepartments({
      activeOnly,
      includeHidden,
      userRole,
    });
    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching departments",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST new department
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole;

  // Only Admins can create new departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const department = await departmentService.createDepartment(
      json,
      session.user.id,
    );
    return NextResponse.json(department);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "DUPLICATE_DEPARTMENT":
          return NextResponse.json(
            {
              error: "Duplicate record found",
              code: "DUPLICATE_DEPARTMENT",
              message: "A department with this name already exists",
            },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error creating department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
