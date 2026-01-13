import { UserRole } from "@/generated/prisma_client";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Check if user can access a specific employee
 * Combines permission checking with business logic
 */
export async function hasAccessToEmployee(
  userId: string | undefined,
  employeeId: number,
) {
  if (!userId) {
    console.error("hasAccessToEmployee: userId is undefined");
    return false;
  }

  // Check if user has admin-level permissions (can edit/delete)
  const isAdmin = await auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        employee: ["edit", "delete"],
      },
    },
  });

  if (isAdmin) {
    return true;
  }

  // Check if user can manage departments (DepartmentManager role)
  const canManageDepartments = await auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        department: ["manage"],
      },
    },
  });

  if (canManageDepartments) {
    // Check if employee is in one of the departments managed by this user
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

  // Check if user can view employees (any role with view permission)
  const canViewEmployees = await auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        employee: ["view"],
      },
    },
  });

  if (canViewEmployees) {
    // Check if this employee is linked to the user
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

// Helper to get current user from better-auth session
export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: new Headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    role: session.user.role as UserRole,
  };
}
