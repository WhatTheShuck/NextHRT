import prisma from "@/lib/prisma";
import { ExemptionStatus, UserRole } from "@/generated/prisma_client";
import { auth } from "../auth";
import { getChildDepartmentIds } from "@/lib/apiRBAC";

export interface GetExemptionsOptions {
  userRole: UserRole;
  userId: string;
}

export class ExemptionService {
  private validateDate(
    dateString: string,
    fieldName: string,
  ): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`INVALID_DATE_${fieldName.toUpperCase()}`);
    }
    return date;
  }

  async getExemptions(options: GetExemptionsOptions) {
    const { userRole, userId } = options;

    const includeClause: any = {
      training: true,
      ticket: true,
      employee: true,
    };
    const whereClause: any = {};

    const canViewAll = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewAll"] } },
    });

    if (canViewAll) {
      return await prisma.trainingTicketExemption.findMany({
        include: includeClause,
        where: whereClause,
      });
    }

    const canViewDepartment = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewDepartment"] } },
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

      // Expand parent departments to include their children
      const childDeptPromises = user.managedDepartments
        .filter((dept) => dept.level === 0)
        .map((dept) => getChildDepartmentIds(dept.id));
      const childDeptIdsArrays = await Promise.all(childDeptPromises);
      departmentIds.push(...childDeptIdsArrays.flat());

      const employees = await prisma.employee.findMany({
        where: { departmentId: { in: departmentIds } },
        select: { id: true },
      });
      const employeeIds = employees.map((emp) => emp.id);
      whereClause.employeeId = { in: employeeIds };

      return await prisma.trainingTicketExemption.findMany({
        where: whereClause,
        include: includeClause,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user || !user.employee) {
      throw new Error("NO_EMPLOYEE_RECORD");
    }

    whereClause.employeeId = user.employee.id;
    return await prisma.trainingTicketExemption.findMany({
      where: whereClause,
      include: includeClause,
    });
  }

  async getExemptionById(
    id: number,
    userRole: UserRole,
    userId: string,
  ) {
    const exemption = await prisma.trainingTicketExemption.findUnique({
      where: { id },
      include: {
        training: true,
        ticket: true,
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    if (!exemption) {
      throw new Error("EXEMPTION_NOT_FOUND");
    }

    const canViewAll = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewAll"] } },
    });

    if (canViewAll) {
      return exemption;
    }

    const canViewDepartment = await auth.api.userHasPermission({
      body: { role: userRole, permissions: { employee: ["viewDepartment"] } },
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

      // Expand parent departments to include their children
      const childDeptPromises = user.managedDepartments
        .filter((dept) => dept.level === 0)
        .map((dept) => getChildDepartmentIds(dept.id));
      const childDeptIdsArrays = await Promise.all(childDeptPromises);
      departmentIds.push(...childDeptIdsArrays.flat());

      if (!departmentIds.includes(exemption.employee.departmentId)) {
        throw new Error("NOT_AUTHORISED");
      }

      return exemption;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (
      !user ||
      !user.employee ||
      user.employee.id !== exemption.employeeId
    ) {
      throw new Error("NOT_AUTHORISED");
    }

    return exemption;
  }

  async createExemption(
    data: {
      type: string;
      employeeId: number;
      ticketId?: number;
      trainingId?: number;
      reason?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
    userId: string,
  ) {
    if (!data.type || (data.type !== "Ticket" && data.type !== "Training")) {
      throw new Error("INVALID_TYPE");
    }

    if (!data.employeeId) {
      throw new Error("MISSING_EMPLOYEE_ID");
    }

    if (data.type === "Ticket" && !data.ticketId) {
      throw new Error("MISSING_TICKET_ID");
    }

    if (data.type === "Training" && !data.trainingId) {
      throw new Error("MISSING_TRAINING_ID");
    }

    const startDate = data.startDate
      ? this.validateDate(data.startDate, "start date")
      : new Date();
    const endDate = data.endDate
      ? this.validateDate(data.endDate, "end date")
      : null;

    if (endDate && endDate <= startDate) {
      throw new Error("END_DATE_BEFORE_START");
    }

    // Check for existing record
    const whereCondition: any = {
      employeeId: data.employeeId,
    };

    if (data.type === "Ticket") {
      whereCondition.ticketId = data.ticketId;
      whereCondition.trainingId = null;
    } else {
      whereCondition.trainingId = data.trainingId;
      whereCondition.ticketId = null;
    }

    const existingRecord = await prisma.trainingTicketExemption.findFirst({
      where: whereCondition,
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_EXEMPTION");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    if (data.type === "Ticket") {
      const ticket = await prisma.ticket.findUnique({
        where: { id: data.ticketId },
      });
      if (!ticket) {
        throw new Error("TICKET_NOT_FOUND");
      }
    } else if (data.type === "Training") {
      const training = await prisma.training.findUnique({
        where: { id: data.trainingId },
      });
      if (!training) {
        throw new Error("TRAINING_NOT_FOUND");
      }
    }

    const exemption = await prisma.trainingTicketExemption.create({
      data: {
        employeeId: data.employeeId,
        type: data.type,
        ticketId: data.type === "Ticket" ? data.ticketId! : null,
        trainingId: data.type === "Training" ? data.trainingId! : null,
        reason: data.reason || "",
        startDate,
        endDate,
        status: (data.status as ExemptionStatus) || "Active",
      },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: exemption.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(exemption),
        userId,
      },
    });

    return exemption;
  }

  async updateExemption(
    id: number,
    data: {
      type?: string;
      employeeId?: number;
      ticketId?: number;
      trainingId?: number;
      reason?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
    userId: string,
  ) {
    const existingExemption = await prisma.trainingTicketExemption.findUnique({
      where: { id },
    });

    if (!existingExemption) {
      throw new Error("EXEMPTION_NOT_FOUND");
    }

    if (data.type && data.type !== "Ticket" && data.type !== "Training") {
      throw new Error("INVALID_TYPE");
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (data.startDate) {
      startDate = this.validateDate(data.startDate, "start date");
    }

    if (data.endDate) {
      endDate = this.validateDate(data.endDate, "end date");
    }

    const effectiveStartDate = startDate || existingExemption.startDate;
    if (endDate && effectiveStartDate && endDate <= effectiveStartDate) {
      throw new Error("END_DATE_BEFORE_START");
    }

    // Check for duplicate if changing key fields
    if (data.employeeId || data.type || data.ticketId || data.trainingId) {
      const whereCondition: any = {
        employeeId: data.employeeId || existingExemption.employeeId,
        id: { not: id },
      };

      const type = data.type || existingExemption.type;
      if (type === "Ticket") {
        whereCondition.ticketId = data.ticketId || existingExemption.ticketId;
        whereCondition.trainingId = null;
      } else {
        whereCondition.trainingId =
          data.trainingId || existingExemption.trainingId;
        whereCondition.ticketId = null;
      }

      const duplicateRecord = await prisma.trainingTicketExemption.findFirst({
        where: whereCondition,
      });

      if (duplicateRecord) {
        throw new Error("DUPLICATE_EXEMPTION");
      }
    }

    const updateData: any = {};

    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.status !== undefined) updateData.status = data.status;
    if (startDate !== null) updateData.startDate = startDate;
    if (data.endDate !== undefined) updateData.endDate = endDate;
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;

    if (data.type && data.type !== existingExemption.type) {
      updateData.type = data.type;
      if (data.type === "Ticket") {
        updateData.ticketId = data.ticketId;
        updateData.trainingId = null;
      } else {
        updateData.trainingId = data.trainingId;
        updateData.ticketId = null;
      }
    } else {
      if (data.ticketId !== undefined) updateData.ticketId = data.ticketId;
      if (data.trainingId !== undefined)
        updateData.trainingId = data.trainingId;
    }

    const updatedExemption = await prisma.trainingTicketExemption.update({
      where: { id },
      data: updateData,
      include: {
        training: true,
        ticket: true,
        employee: true,
      },
    });

    const changedFields = Object.keys({
      ...(data.reason !== undefined && { reason: true }),
      ...(data.status !== undefined && { status: true }),
      ...(startDate !== null && { startDate: true }),
      ...(data.endDate !== undefined && { endDate: true }),
      ...(data.employeeId !== undefined && { employeeId: true }),
      ...(data.type &&
        data.type !== existingExemption.type && {
          type: true,
          ticketId: true,
          trainingId: true,
        }),
      ...((!data.type || data.type === existingExemption.type) && {
        ...(data.ticketId !== undefined && { ticketId: true }),
        ...(data.trainingId !== undefined && { trainingId: true }),
      }),
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: id.toString(),
        action: "UPDATE",
        changedFields: JSON.stringify(changedFields),
        oldValues: JSON.stringify(existingExemption),
        newValues: JSON.stringify(updatedExemption),
        userId,
      },
    });

    return updatedExemption;
  }

  async deleteExemption(id: number, userId: string) {
    const existingExemption = await prisma.trainingTicketExemption.findUnique({
      where: { id },
      include: {
        training: true,
        ticket: true,
        employee: true,
      },
    });

    if (!existingExemption) {
      throw new Error("EXEMPTION_NOT_FOUND");
    }

    await prisma.trainingTicketExemption.delete({
      where: { id },
    });

    await prisma.history.create({
      data: {
        tableName: "TrainingTicketExemption",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingExemption),
        userId,
      },
    });

    return {
      message: "Exemption record deleted successfully",
      deletedRecord: existingExemption,
    };
  }
}

export const exemptionService = new ExemptionService();
