import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";

/**
 * Check if user can access a specific employee.
 * Pass userRole from the session to avoid an extra DB lookup inside userHasPermission.
 */
export async function hasAccessToEmployee(
  userId: string | undefined,
  employeeId: number,
  userRole: string,
) {
  if (!userId) {
    console.error("hasAccessToEmployee: userId is undefined");
    return false;
  }

  // Check if user can view all employees
  const canViewAll = await auth.api.userHasPermission({
    body: {
      role: userRole as UserRole,
      permissions: {
        employee: ["viewAll"],
      },
    },
  });

  if (canViewAll) {
    return true;
  }

  // Check if user can view department employees
  const canViewDepartment = await auth.api.userHasPermission({
    body: {
      role: userRole as UserRole,
      permissions: {
        employee: ["viewDepartment"],
      },
    },
  });

  if (canViewDepartment) {
    // Get user's managed departments
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedDepartments: true },
    });

    if (!user) return false;

    // Get all accessible department IDs
    const accessibleDepartmentIds: number[] = [];
    for (const dept of user.managedDepartments) {
      if (dept.level === 0) {
        // Parent department - get all child departments
        const childDepartments = await prisma.department.findMany({
          where: { parentDepartmentId: dept.id },
          select: { id: true },
        });
        accessibleDepartmentIds.push(dept.id);
        accessibleDepartmentIds.push(
          ...childDepartments.map((child) => child.id),
        );
      } else if (dept.level === 1) {
        // Child department - only access to itself
        accessibleDepartmentIds.push(dept.id);
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });

    if (!employee) return false;
    return accessibleDepartmentIds.includes(employee.departmentId);
  }

  // Check if user can view their own employee record
  const canViewSelf = await auth.api.userHasPermission({
    body: {
      role: userRole as UserRole,
      permissions: {
        employee: ["viewSelf"],
      },
    },
  });

  if (canViewSelf) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    return user?.employeeId === employeeId;
  }

  return false;
}

export async function getManagedDepartmentIds(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { managedDepartments: true },
  });

  if (!user) return [];
  return user.managedDepartments.map((dept) => dept.id);
}

export async function getUserEmployeeId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true },
  });
  return user?.employeeId;
}

export async function getChildDepartmentIds(
  departmentId: number,
): Promise<number[]> {
  const childDepartments = await prisma.department.findMany({
    where: { parentDepartmentId: departmentId },
    select: { id: true },
  });
  return childDepartments.map((dept) => dept.id);
}
