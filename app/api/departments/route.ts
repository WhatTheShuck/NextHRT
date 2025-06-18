import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all departments
export const GET = auth(async function GET(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;

  // All authenticated users can view departments (needed for dropdowns)
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
        managers:
          userRole === "Admin"
            ? {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              }
            : false,
      },
      orderBy: {
        name: "asc",
      },
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
});

// POST new department
export const POST = auth(async function POST(req) {
  // Check if the user is authenticated
  if (!req.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = req.auth.user?.role as UserRole;

  // Only Admins can create new departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const json = await req.json();

    const department = await prisma.department.create({
      data: {
        name: json.name,
      },
      include: {
        _count: {
          select: { employees: true },
        },
        managers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Department",
        recordId: department.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(department),
        userId: req.auth.user?.id,
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error creating department",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
