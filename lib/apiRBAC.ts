import { UserRole } from "@/generated/prisma_client";
import prisma from "@/lib/prisma";

const roleHierarchy: Record<UserRole, UserRole[]> = {
  Admin: ["DepartmentManager", "FireWarden", "EmployeeViewer", "User"],
  DepartmentManager: ["EmployeeViewer", "User"],
  FireWarden: ["EmployeeViewer", "User"],
  EmployeeViewer: ["User"],
  User: [],
};
export async function hasAccessToEmployee(
  userId: string | undefined,
  employeeId: number,
  userRole: UserRole,
) {
  if (!userId) {
    console.error("hasAccessToEmployee: userId is undefined");
    return false;
  }
  if (userRole === "Admin") {
    return true;
  }

  if (userRole === "DepartmentManager") {
    // Check if employee is in one of the departments managed by this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { managedDepartments: true },
    });

    if (!user) return false;

    const departmentIds = user.managedDepartments.map((dept) => dept.id);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });

    if (!employee) return false;

    return departmentIds.includes(employee.departmentId);
  }

  if (userRole === "User") {
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

export function hasRoleAccess(
  userRole: UserRole,
  requiredRole: UserRole,
): boolean {
  if (userRole === requiredRole) return true;

  return roleHierarchy[userRole]?.includes(requiredRole) || false;
}
