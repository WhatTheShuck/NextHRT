import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";

// GET all departments

export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  // Check if the user is authenticated
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const includeHiddenDepartment = searchParams.get("includeHidden") === "true";
  const whereClause: any = {};
  if (activeOnly) {
    whereClause.isActive = true;
  }
  if (!includeHiddenDepartment) {
    whereClause.id = {
      not: -1,
    };
  }

  const userRole = request.auth.user?.role as UserRole;
  // All authenticated users can view departments (needed for dropdowns)
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
        employees: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
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
      where: whereClause,
      orderBy: {
        name: "asc",
      },
    });

    // Transform the data to include activeEmployees count
    const departmentsWithActiveCounts = departments.map((department) => ({
      ...department,
      _count: {
        employees: department._count.employees,
        activeEmployees: department.employees.length,
      },
      employees: undefined, // Remove the employees array from the response
    }));

    return NextResponse.json(departmentsWithActiveCounts);
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

    // Check for duplicate based on unique constraint
    const existingRecord = await prisma.department.findFirst({
      where: {
        name: json.name,
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          error: "Duplicate record found",
          code: "DUPLICATE_DEPARTMENT",
          message: "A department with this name already exists",
        },
        { status: 409 },
      );
    }
    const department = await prisma.department.create({
      data: {
        name: json.name,
        parentDepartmentId: json.parentDepartmentId || null,
        isActive: json.isActive,
        level: json.parentDepartmentId ? 1 : 0,
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
