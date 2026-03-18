import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client/client";

export interface AccessorInfo {
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  accessReason: "Admin" | "DepartmentManager" | "Self";
}

export interface EmployeeAccessInfo {
  employeeId: number;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  accessors: AccessorInfo[];
  accessorNames: string;
  accessorCount: number;
}

class AccessCheckService {
  // Build accessor list for a given employee from pre-fetched data
  private buildAccessors(
    employee: {
      id: number;
      firstName: string;
      lastName: string;
      departmentId: number;
      department: { name: string };
      location: { name: string };
    },
    adminUsers: { id: string; name: string | null; email: string | null; role: UserRole | null }[],
    managerUsers: {
      id: string;
      name: string | null;
      email: string | null;
      role: UserRole | null;
      managedDepartments: { id: number; level: number; parentDepartmentId: number | null }[];
    }[],
    childDeptMap: Map<number, number[]>,
    selfUser: { id: string; name: string | null; email: string | null; role: UserRole | null } | null,
  ): AccessorInfo[] {
    const accessors: AccessorInfo[] = [];
    const addedUserIds = new Set<string>();

    // Admins
    for (const admin of adminUsers) {
      if (!addedUserIds.has(admin.id)) {
        accessors.push({
          userId: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          accessReason: "Admin",
        });
        addedUserIds.add(admin.id);
      }
    }

    // Department managers
    for (const manager of managerUsers) {
      if (addedUserIds.has(manager.id)) continue;
      for (const dept of manager.managedDepartments) {
        let covers = false;
        if (dept.id === employee.departmentId) {
          covers = true;
        } else if (dept.level === 0) {
          const children = childDeptMap.get(dept.id) ?? [];
          if (children.includes(employee.departmentId)) {
            covers = true;
          }
        }
        if (covers) {
          accessors.push({
            userId: manager.id,
            name: manager.name,
            email: manager.email,
            role: manager.role,
            accessReason: "DepartmentManager",
          });
          addedUserIds.add(manager.id);
          break;
        }
      }
    }

    // Self
    if (selfUser && !addedUserIds.has(selfUser.id)) {
      accessors.push({
        userId: selfUser.id,
        name: selfUser.name,
        email: selfUser.email,
        role: selfUser.role,
        accessReason: "Self",
      });
      addedUserIds.add(selfUser.id);
    }

    return accessors;
  }

  private toEmployeeAccessInfo(
    employee: {
      id: number;
      firstName: string;
      lastName: string;
      departmentId: number;
      department: { name: string };
      location: { name: string };
    },
    accessors: AccessorInfo[],
  ): EmployeeAccessInfo {
    return {
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department.name,
      location: employee.location.name,
      accessors,
      accessorNames: accessors.map((a) => a.name ?? a.email ?? "Unknown").join(" | "),
      accessorCount: accessors.length,
    };
  }

  // Fetch shared data needed for access computation
  private async fetchSharedData() {
    const [adminUsers, managerUsers, allChildDepts] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.Admin },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.user.findMany({
        where: { role: UserRole.DepartmentManager },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          managedDepartments: {
            select: { id: true, level: true, parentDepartmentId: true },
          },
        },
      }),
      prisma.department.findMany({
        where: { level: 1 },
        select: { id: true, parentDepartmentId: true },
      }),
    ]);

    // Build a map: parentDeptId -> [childDeptIds]
    const childDeptMap = new Map<number, number[]>();
    for (const child of allChildDepts) {
      if (child.parentDepartmentId !== null) {
        if (!childDeptMap.has(child.parentDepartmentId)) {
          childDeptMap.set(child.parentDepartmentId, []);
        }
        childDeptMap.get(child.parentDepartmentId)!.push(child.id);
      }
    }

    return { adminUsers, managerUsers, childDeptMap };
  }

  async getUsersWithAccessToEmployee(employeeId: number): Promise<EmployeeAccessInfo> {
    const [employee, { adminUsers, managerUsers, childDeptMap }] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
      }),
      this.fetchSharedData(),
    ]);

    if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

    const selfUser = await prisma.user.findFirst({
      where: { employeeId: employeeId },
      select: { id: true, name: true, email: true, role: true },
    });

    const accessors = this.buildAccessors(employee, adminUsers, managerUsers, childDeptMap, selfUser);
    return this.toEmployeeAccessInfo(employee, accessors);
  }

  async getAllEmployeesWithAccessors(activeOnly = true): Promise<EmployeeAccessInfo[]> {
    const [employees, { adminUsers, managerUsers, childDeptMap }, linkedUsers] = await Promise.all([
      prisma.employee.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { lastName: "asc" },
      }),
      this.fetchSharedData(),
      prisma.user.findMany({
        where: { employeeId: { not: null } },
        select: { id: true, name: true, email: true, role: true, employeeId: true },
      }),
    ]);

    const selfByEmployeeId = new Map<number, typeof linkedUsers[number]>();
    for (const u of linkedUsers) {
      if (u.employeeId !== null) selfByEmployeeId.set(u.employeeId, u);
    }

    return employees.map((emp) => {
      const selfUser = selfByEmployeeId.get(emp.id) ?? null;
      const accessors = this.buildAccessors(emp, adminUsers, managerUsers, childDeptMap, selfUser);
      return this.toEmployeeAccessInfo(emp, accessors);
    });
  }

  async getDepartmentEmployeesWithAccessors(departmentId: number): Promise<EmployeeAccessInfo[]> {
    const [employees, { adminUsers, managerUsers, childDeptMap }, linkedUsers] = await Promise.all([
      prisma.employee.findMany({
        where: { departmentId: departmentId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { lastName: "asc" },
      }),
      this.fetchSharedData(),
      prisma.user.findMany({
        where: { employeeId: { not: null } },
        select: { id: true, name: true, email: true, role: true, employeeId: true },
      }),
    ]);

    const selfByEmployeeId = new Map<number, typeof linkedUsers[number]>();
    for (const u of linkedUsers) {
      if (u.employeeId !== null) selfByEmployeeId.set(u.employeeId, u);
    }

    return employees.map((emp) => {
      const selfUser = selfByEmployeeId.get(emp.id) ?? null;
      const accessors = this.buildAccessors(emp, adminUsers, managerUsers, childDeptMap, selfUser);
      return this.toEmployeeAccessInfo(emp, accessors);
    });
  }

  async getLocationEmployeesWithAccessors(locationId: number): Promise<EmployeeAccessInfo[]> {
    const [employees, { adminUsers, managerUsers, childDeptMap }, linkedUsers] = await Promise.all([
      prisma.employee.findMany({
        where: { locationId: locationId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentId: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
        orderBy: { lastName: "asc" },
      }),
      this.fetchSharedData(),
      prisma.user.findMany({
        where: { employeeId: { not: null } },
        select: { id: true, name: true, email: true, role: true, employeeId: true },
      }),
    ]);

    const selfByEmployeeId = new Map<number, typeof linkedUsers[number]>();
    for (const u of linkedUsers) {
      if (u.employeeId !== null) selfByEmployeeId.set(u.employeeId, u);
    }

    return employees.map((emp) => {
      const selfUser = selfByEmployeeId.get(emp.id) ?? null;
      const accessors = this.buildAccessors(emp, adminUsers, managerUsers, childDeptMap, selfUser);
      return this.toEmployeeAccessInfo(emp, accessors);
    });
  }
}

export const accessCheckService = new AccessCheckService();
