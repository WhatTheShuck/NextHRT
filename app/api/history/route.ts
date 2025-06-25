import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

// GET all history records (with optional filtering)
export const GET = auth(async function GET(request) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const userId = request.auth.user?.id;
  const userRole = request.auth.user?.role as UserRole;

  // Only Admins and Department Managers can view history
  if (userRole !== "Admin" && userRole !== "DepartmentManager") {
    return NextResponse.json(
      { error: "Not authorised to view history records" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("tableName");
    const recordId = searchParams.get("recordId");
    const action = searchParams.get("action");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build where clause based on query parameters
    const whereClause: any = {};

    if (tableName) {
      whereClause.tableName = tableName;
    }

    if (recordId) {
      whereClause.recordId = recordId;
    }

    if (action) {
      whereClause.action = action;
    }

    // If user is a Department Manager, restrict to employees in their departments
    if (userRole === "DepartmentManager") {
      const managedDepartments = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          managedDepartments: true,
        },
      });

      if (!managedDepartments?.managedDepartments.length) {
        return NextResponse.json(
          { error: "No managed departments found" },
          { status: 403 },
        );
      }

      // If filtering by Employee table, restrict to employees in managed departments
      if (!tableName || tableName === "Employee") {
        const managedEmployeeIds = await prisma.employee.findMany({
          where: {
            departmentId: {
              in: managedDepartments.managedDepartments.map((dept) => dept.id),
            },
          },
          select: { id: true },
        });

        const employeeIdStrings = managedEmployeeIds.map((emp) =>
          emp.id.toString(),
        );

        if (tableName === "Employee" || !tableName) {
          whereClause.AND = [
            whereClause,
            {
              OR: [
                {
                  tableName: { not: "Employee" },
                },
                {
                  AND: [
                    { tableName: "Employee" },
                    { recordId: { in: employeeIdStrings } },
                  ],
                },
              ],
            },
          ];
        }
      }
    }

    const history = await prisma.history.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    });

    // Get total count for pagination
    const totalCount = await prisma.history.count({
      where: whereClause,
    });

    return NextResponse.json({
      data: history,
      totalCount,
      hasMore: limit
        ? totalCount > parseInt(limit) + parseInt(offset || "0")
        : false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching history records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
