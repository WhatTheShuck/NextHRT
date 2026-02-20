import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { auth } from "../auth";

export interface GetDepartmentsOptions {
  activeOnly?: boolean;
  includeHidden?: boolean;
  userRole: UserRole;
}

export interface GetDepartmentByIdOptions {
  activeOnly?: boolean;
  userRole: UserRole;
}

export class DepartmentService {
  async getDepartments(options: GetDepartmentsOptions) {
    const { activeOnly, includeHidden, userRole } = options;

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.isActive = true;
    }
    if (!includeHidden) {
      whereClause.id = { not: -1 };
    }

    const canViewManagers = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { user: ["list"] } },
    });

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
        managers: canViewManagers
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

    return departments.map((department) => ({
      ...department,
      _count: {
        employees: department._count.employees,
        activeEmployees: department.employees.length,
      },
      employees: undefined,
    }));
  }

  async getDepartmentById(id: number, options: GetDepartmentByIdOptions) {
    const { activeOnly, userRole } = options;

    const canViewManagers = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { user: ["list"] } },
    });

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            location: {
              select: {
                name: true,
                state: true,
              },
            },
          },
          where: activeOnly ? { isActive: true } : undefined,
        },
        _count: {
          select: { employees: true },
        },
        managers: canViewManagers
          ? {
              select: {
                id: true,
                name: true,
                email: true,
              },
            }
          : false,
      },
    });

    if (!department) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }

    return department;
  }

  async createDepartment(
    data: {
      name: string;
      parentDepartmentId?: number | null;
      isActive?: boolean;
    },
    userId: string,
  ) {
    const existingRecord = await prisma.department.findFirst({
      where: { name: data.name },
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_DEPARTMENT");
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        parentDepartmentId: data.parentDepartmentId || null,
        isActive: data.isActive,
        level: data.parentDepartmentId ? 1 : 0,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Department",
        recordId: department.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(department),
        userId,
      },
    });

    return department;
  }

  async updateDepartment(
    id: number,
    data: {
      name: string;
      isActive?: boolean;
      parentDepartmentId?: number | null;
    },
    userId: string,
  ) {
    const currentDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!currentDepartment) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }

    const existingRecord = await prisma.department.findFirst({
      where: {
        name: data.name,
        id: { not: id },
      },
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_DEPARTMENT");
    }

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        parentDepartmentId: data.parentDepartmentId || null,
        level: data.parentDepartmentId ? 1 : 0,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Department",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentDepartment),
        newValues: JSON.stringify(updatedDepartment),
        userId,
      },
    });

    return updatedDepartment;
  }

  async deleteDepartment(id: number, userId: string) {
    const employeeCount = await prisma.employee.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      throw new Error("DEPARTMENT_HAS_EMPLOYEES");
    }

    const currentDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!currentDepartment) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "Department",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentDepartment),
          userId,
        },
      }),
      prisma.department.delete({
        where: { id },
      }),
    ]);

    return { message: "Department deleted successfully" };
  }
}

export const departmentService = new DepartmentService();
