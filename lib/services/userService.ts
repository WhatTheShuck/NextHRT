import prisma from "@/lib/prisma";

export interface GetUsersOptions {
  includeEmployee?: boolean;
}

export class UserService {
  async getUsers(options: GetUsersOptions) {
    const { includeEmployee } = options;

    const users = await prisma.user.findMany({
      include: {
        employee: includeEmployee
          ? {
              include: {
                department: true,
                location: true,
              },
            }
          : false,
        managedDepartments: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users;
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
        managedDepartments: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return user;
  }

  async updateUser(
    id: string,
    data: {
      role?: string;
      managedDepartmentIds?: number[];
    },
    userId: string,
  ) {
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { managedDepartments: true },
    });

    if (!currentUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const updateData: any = {};

    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    if (data.managedDepartmentIds !== undefined) {
      updateData.managedDepartments = {
        set: data.managedDepartmentIds.map((id: number) => ({ id })),
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
        managedDepartments: true,
      },
    });

    const changedFields = Object.keys(data);
    const oldValues = {
      role: currentUser.role,
      managedDepartments: currentUser.managedDepartments.map((d) => d.id),
    };
    const newValues = {
      role: updatedUser.role,
      managedDepartments: updatedUser.managedDepartments.map((d) => d.id),
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: id,
        action: "UPDATE",
        changedFields: JSON.stringify(changedFields),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId,
      },
    });

    return updatedUser;
  }

  async deleteUser(id: string, userId: string) {
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: { managedDepartments: true },
    });

    if (!userToDelete) {
      throw new Error("USER_NOT_FOUND");
    }

    await prisma.user.delete({
      where: { id },
    });

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: id,
        action: "DELETE",
        oldValues: JSON.stringify(userToDelete),
        userId,
      },
    });

    return { message: "User deleted successfully" };
  }

  async getManagedDepartments(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        managedDepartments: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return user.managedDepartments;
  }

  async updateManagedDepartments(
    id: string,
    departmentIds: number[] | null,
    userId: string,
  ) {
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { managedDepartments: true },
    });

    if (!currentUser) {
      throw new Error("USER_NOT_FOUND");
    }

    if (departmentIds && departmentIds.length > 0) {
      const existingDepartments = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
      });

      if (existingDepartments.length !== departmentIds.length) {
        throw new Error("DEPARTMENTS_NOT_FOUND");
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        managedDepartments: {
          set: departmentIds
            ? departmentIds.map((id: number) => ({ id }))
            : [],
        },
      },
      include: {
        managedDepartments: true,
      },
    });

    const oldValues = {
      managedDepartments: currentUser.managedDepartments.map((d) => d.id),
    };
    const newValues = {
      managedDepartments: updatedUser.managedDepartments.map((d) => d.id),
    };

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: id,
        action: "UPDATE",
        changedFields: JSON.stringify(["managedDepartments"]),
        oldValues: JSON.stringify(oldValues),
        newValues: JSON.stringify(newValues),
        userId,
      },
    });

    return updatedUser.managedDepartments;
  }

  async linkEmployee(id: string, employeeId: number, userId: string) {
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!currentUser) {
      throw new Error("USER_NOT_FOUND");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    const existingUserLink = await prisma.user.findFirst({
      where: {
        employeeId,
        id: { not: id },
      },
    });

    if (existingUserLink) {
      throw new Error("EMPLOYEE_ALREADY_LINKED");
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        employeeId,
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
        managedDepartments: true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: id,
        action: "UPDATE",
        changedFields: JSON.stringify(["employeeId"]),
        oldValues: JSON.stringify({ employeeId: currentUser.employeeId }),
        newValues: JSON.stringify({ employeeId: updatedUser.employeeId }),
        userId,
      },
    });

    return updatedUser;
  }

  async unlinkEmployee(id: string, userId: string) {
    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!currentUser) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!currentUser.employeeId) {
      throw new Error("NO_EMPLOYEE_LINKED");
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        employeeId: null,
      },
      include: {
        employee: true,
        managedDepartments: true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "User",
        recordId: id,
        action: "UPDATE",
        changedFields: JSON.stringify(["employeeId"]),
        oldValues: JSON.stringify({ employeeId: currentUser.employeeId }),
        newValues: JSON.stringify({ employeeId: null }),
        userId,
      },
    });

    return updatedUser;
  }
}

export const userService = new UserService();
