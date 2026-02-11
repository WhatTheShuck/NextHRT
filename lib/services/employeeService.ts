import prisma from "@/lib/prisma";
import { UserRole, Prisma } from "@/generated/prisma_client";
import { getChildDepartmentIds } from "@/lib/apiRBAC";
import { auth } from "../auth";

export interface GetEmployeesOptions {
  activeOnly?: boolean;
  reportType?: string | null;
  startedFrom?: string | null;
  startedTo?: string | null;
  userRole: UserRole;
  userId: string;
  filterByUserId?: string | null; // Filter to get employee for a specific user
}

export class EmployeeService {
  async getEmployees(options: GetEmployeesOptions) {
    const { activeOnly, reportType, startedFrom, startedTo, userRole, userId } =
      options;

    const whereClause: Prisma.EmployeeWhereInput = {};

    if (activeOnly) {
      whereClause.isActive = true;
    }

    if (startedFrom) {
      whereClause.startDate = { gte: new Date(startedFrom) };
      if (startedTo) {
        whereClause.startDate = {
          ...whereClause.startDate,
          lte: new Date(startedTo),
        };
      }
    }

    // Admins can see all employees
    const canViewAll = await auth.api.userHasPermission({
      body: {
        userId,
        permissions: { employee: ["viewAll"] },
      },
    });
    if (canViewAll) {
      return await prisma.employee.findMany({
        include: {
          department: true,
          location: true,
        },
        where: whereClause,
        orderBy: {
          lastName: "asc",
        },
      });
    }

    // Evacuation report with EmployeeViewer access
    if (reportType === "evacuation") {
      const canViewEvac = await auth.api.userHasPermission({
        body: {
          userId,
          permissions: { employee: ["viewEvacReport"] },
        },
      });
      if (!canViewEvac) {
        throw new Error("NO_EMPLOYEE_VIEWER_ACCESS");
      }

      return await prisma.employee.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          isActive: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
        },
        where: whereClause,
        orderBy: {
          lastName: "asc",
        },
      });
    }

    // Department managers can see their department employees
    const canViewDepartment = await auth.api.userHasPermission({
      body: {
        userId,
        permissions: { employee: ["viewDepartment"] },
      },
    });
    if (canViewDepartment) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      // Fetch child department IDs for parent departments (level === 0)
      const childDeptPromises = user.managedDepartments
        .filter((dept) => dept.level === 0)
        .map((dept) => getChildDepartmentIds(dept.id));

      const childDeptIdsArrays = await Promise.all(childDeptPromises);
      const childDeptIds = childDeptIdsArrays.flat();
      departmentIds.push(...childDeptIds);

      return await prisma.employee.findMany({
        where: {
          ...whereClause,
          departmentId: { in: departmentIds },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          lastName: "asc",
        },
      });
    }

    // Regular users can only see themselves
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      throw new Error("NO_EMPLOYEE_RECORD");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.employee.id },
      include: {
        department: true,
        location: true,
      },
    });

    return [employee];
  }

  async createEmployee(
    data: {
      firstName: string;
      lastName: string;
      title: string;
      startDate: string;
      finishDate?: string | null;
      departmentId: number;
      locationId: number;
      notes?: string | null;
      usi?: string | null;
      status?: string;
      isActive?: boolean;
      confirmDuplicate?: boolean;
    },
    userId: string,
  ) {
    // Check for duplicate detection unless confirmDuplicate flag is set
    if (!data.confirmDuplicate) {
      const potentialDuplicates = await prisma.employee.findMany({
        where: {
          firstName: {
            equals: data.firstName,
          },
          lastName: {
            equals: data.lastName,
          },
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          finishDate: "desc",
        },
      });

      if (potentialDuplicates.length > 0) {
        const suggestions = {
          rehire: potentialDuplicates.some((emp) => !emp.isActive),
          duplicate: true,
        };

        throw {
          code: "DUPLICATE_EMPLOYEE",
          matches: potentialDuplicates.map((emp) => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            title: emp.title,
            department: emp.department || "Unknown",
            location: emp.location || "Unknown",
            isActive: emp.isActive,
            startDate: emp.startDate,
            finishDate: emp.finishDate,
          })),
          suggestions,
        };
      }
    }

    // Create the employee
    const employee = await prisma.employee.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        startDate: new Date(data.startDate),
        finishDate: data.finishDate ? new Date(data.finishDate) : null,
        department: {
          connect: { id: data.departmentId },
        },
        location: {
          connect: { id: data.locationId },
        },
        notes: data.notes,
        usi: data.usi,
        status: data.status as any,
        isActive: data.isActive ?? true,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Employee",
        recordId: employee.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(employee),
        userId: userId,
      },
    });

    return employee;
  }

  async getEmployeeById(
    employeeId: number,
    includeExemptions: boolean = false,
  ) {
    const includeClause: Prisma.EmployeeInclude = {
      department: true,
      location: true,
      trainingRecords: {
        include: {
          training: true,
        },
      },
      ticketRecords: {
        include: {
          ticket: true,
          images: true,
        },
      },
      User: true,
    };

    if (includeExemptions) {
      includeClause.trainingTicketExemptions = {
        include: {
          training: true,
          ticket: true,
        },
      };
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: includeClause,
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    return employee;
  }

  async updateEmployeePartial(
    employeeId: number,
    data: {
      firstName?: string;
      lastName?: string;
      title?: string;
      startDate?: string | null;
      finishDate?: string | null;
      departmentId?: number;
      locationId?: number;
      notes?: string | null;
      usi?: string | null;
      isActive?: boolean;
    },
    userId: string,
  ) {
    // Get current employee data for history
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!currentEmployee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    // Build update data object only with provided fields
    const updateData: Prisma.EmployeeUpdateInput = {};

    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.usi !== undefined) updateData.usi = data.usi;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Handle date fields
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate
        ? new Date(data.startDate)
        : (undefined as any);
    }
    if (data.finishDate !== undefined) {
      updateData.finishDate = data.finishDate
        ? new Date(data.finishDate)
        : null;
    }

    // Handle relational fields
    if (data.departmentId !== undefined) {
      updateData.department = { connect: { id: data.departmentId } };
    }
    if (data.locationId !== undefined) {
      updateData.location = { connect: { id: data.locationId } };
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      include: {
        department: true,
        location: true,
        trainingRecords: {
          include: {
            training: true,
          },
        },
        ticketRecords: {
          include: {
            ticket: true,
          },
        },
        User: true,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Employee",
        recordId: employeeId.toString(),
        action: "PATCH",
        oldValues: JSON.stringify(currentEmployee),
        newValues: JSON.stringify(data),
        userId: userId,
      },
    });

    return updatedEmployee;
  }

  async updateEmployeeFull(
    employeeId: number,
    data: {
      firstName: string;
      lastName: string;
      title: string;
      startDate: string;
      finishDate?: string | null;
      departmentId: number;
      locationId: number;
      notes?: string | null;
      usi?: string | null;
      status?: string;
      isActive?: boolean;
    },
    userId: string,
  ) {
    // Get current employee data for history
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!currentEmployee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        startDate: new Date(data.startDate),
        finishDate: data.finishDate ? new Date(data.finishDate) : null,
        department: {
          connect: { id: data.departmentId },
        },
        location: {
          connect: { id: data.locationId },
        },
        notes: data.notes,
        usi: data.usi,
        status: data.status as any,
        isActive: data.isActive ?? true,
      },
    });

    // Create history record
    await prisma.history.create({
      data: {
        tableName: "Employee",
        recordId: employeeId.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentEmployee),
        newValues: JSON.stringify(updatedEmployee),
        userId: userId,
      },
    });

    return updatedEmployee;
  }

  async deleteEmployee(employeeId: number, userId: string) {
    // Get current employee data for history
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!currentEmployee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    // Delete related records and employee in a transaction
    await prisma.$transaction([
      prisma.trainingRecords.deleteMany({
        where: { employeeId: employeeId },
      }),
      prisma.ticketRecords.deleteMany({
        where: { employeeId: employeeId },
      }),
      prisma.user.updateMany({
        where: { employeeId: employeeId },
        data: { employeeId: null },
      }),
      prisma.history.create({
        data: {
          tableName: "Employee",
          recordId: employeeId.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentEmployee),
          userId: userId,
        },
      }),
      prisma.employee.delete({
        where: { id: employeeId },
      }),
    ]);

    return { message: "Employee deleted successfully" };
  }
}

export const employeeService = new EmployeeService();
