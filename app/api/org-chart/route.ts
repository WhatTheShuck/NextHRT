import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  try {
    const employeeInclude = {
      User: {
        select: { id: true, name: true, email: true, role: true },
      },
      location: {
        select: { name: true, state: true },
      },
    };

    const managerSelect = {
      id: true,
      name: true,
      email: true,
      role: true,
      canManageChildrenDepartments: true,
    };

    const rootDepartments = await prisma.department.findMany({
      where: { parentDepartmentId: null, id: { not: -1 } },
      orderBy: { name: "asc" },
      include: {
        employees: { include: employeeInclude, orderBy: { lastName: "asc" } },
        managers: { select: managerSelect },
        childDepartments: {
          orderBy: { name: "asc" },
          include: {
            employees: { include: employeeInclude, orderBy: { lastName: "asc" } },
            managers: { select: managerSelect },
          },
        },
      },
    });

    const unlinkedUsers = await prisma.user.findMany({
      where: { employeeId: null },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    // Calculate stats across all departments
    let totalDepts = 0;
    let totalEmployees = 0;
    let linkedEmployees = 0;
    let deptsWithoutManagers = 0;
    let emptyDepts = 0;

    for (const dept of rootDepartments) {
      totalDepts++;
      if (dept.managers.length === 0) deptsWithoutManagers++;
      if (dept.employees.length === 0 && dept.childDepartments.length === 0) emptyDepts++;
      for (const emp of dept.employees) {
        totalEmployees++;
        if (emp.User) linkedEmployees++;
      }
      const parentCoversChildren = dept.managers.some((m) => m.canManageChildrenDepartments);
      for (const child of dept.childDepartments) {
        totalDepts++;
        if (child.managers.length === 0 && !parentCoversChildren) deptsWithoutManagers++;
        if (child.employees.length === 0) emptyDepts++;
        for (const emp of child.employees) {
          totalEmployees++;
          if (emp.User) linkedEmployees++;
        }
      }
    }

    return NextResponse.json({
      departments: rootDepartments,
      unlinkedUsers,
      stats: {
        totalDepartments: totalDepts,
        totalEmployees,
        linkedEmployees,
        unlinkedEmployees: totalEmployees - linkedEmployees,
        unlinkedUsers: unlinkedUsers.length,
        departmentsWithoutManagers: deptsWithoutManagers,
        emptyDepartments: emptyDepts,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch org chart data" }, { status: 500 });
  }
}
