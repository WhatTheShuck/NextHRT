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

  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
        // managers: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //   }
        // }
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
export const POST = auth(async function POST(request) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userRole = request.auth.user?.role as UserRole;
  const userId = request.auth.user?.id;

  // Only Admins can create departments
  if (userRole !== "Admin") {
    return NextResponse.json({ message: "Not authorized" }, { status: 403 });
  }

  try {
    const json = await request.json();

    const department = await prisma.department.create({
      data: {
        name: json.name,
        managers: json.managerIds
          ? {
              connect: json.managerIds.map((id: string) => ({ id })),
            }
          : undefined,
      },
      // include: {
      //   managers: {
      //     select: {
      //       id: true,
      //       name: true,
      //       email: true,
      //     }
      // }
      // }
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Department",
        recordId: department.id,
        action: "CREATE",
        newValues: JSON.stringify(department),
        userId: userId,
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
