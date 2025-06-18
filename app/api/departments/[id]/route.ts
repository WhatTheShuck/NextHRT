import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET all departments with employee counts
export const GET = auth(async function GET(request) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
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

// POST create new department
export const POST = auth(async function POST(request) {
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

    if (!json.name || !json.name.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 },
      );
    }

    // Check if department name already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: {
          equals: json.name.trim(),
        },
      },
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 400 },
      );
    }

    const newDepartment = await prisma.department.create({
      data: {
        name: json.name.trim(),
        managers: json.managerIds
          ? {
              connect: json.managerIds.map((id: string) => ({ id })),
            }
          : undefined,
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
        recordId: newDepartment.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(newDepartment),
        userId: userId,
      },
    });

    return NextResponse.json(newDepartment);
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
