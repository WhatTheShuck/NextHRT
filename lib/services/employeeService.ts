import prisma from "@/lib/prisma";
import { UserRole, Prisma, EmployeeStatus } from "@/generated/prisma_client/client";
import { getChildDepartmentIds } from "@/lib/apiRBAC";
import { auth } from "../auth";
import { deriveEmploymentType, serializePriorStint } from "@/lib/employment";
import { enqueue } from "@/lib/jobs/jobQueue";

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
        role: userRole,
        permissions: { employee: ["viewAll"] },
      },
    });
    if (canViewAll.success) {
      return await prisma.employee.findMany({
        include: {
          department: true,
          location: true,
        },
        where: whereClause,
        orderBy: {
          legalLastName: "asc",
        },
      });
    }

    // Evacuation report with EmployeeViewer access
    if (reportType === "evacuation") {
      const canViewEvac = await auth.api.userHasPermission({
        body: {
          role: userRole,
          permissions: { employee: ["viewEvacReport"] },
        },
      });
      if (!canViewEvac.success) {
        throw new Error("NO_EMPLOYEE_VIEWER_ACCESS");
      }

      return await prisma.employee.findMany({
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
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
          legalLastName: "asc",
        },
      });
    }

    // Department managers can see their department employees
    const canViewDepartment = await auth.api.userHasPermission({
      body: {
        role: userRole,
        permissions: { employee: ["viewDepartment"] },
      },
    });
    if (canViewDepartment.success) {
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

      const departmentFilter: Prisma.EmployeeWhereInput = user.employeeId
        ? { OR: [{ departmentId: { in: departmentIds } }, { id: user.employeeId }] }
        : { departmentId: { in: departmentIds } };

      return await prisma.employee.findMany({
        where: {
          ...whereClause,
          ...departmentFilter,
        },
        include: {
          department: true,
          location: true,
        },
        orderBy: {
          legalLastName: "asc",
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
      legalFirstName: string;
      legalLastName: string;
      preferredFirstName?: string | null;
      preferredLastName?: string | null;
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
      jobFamilyId?: number | null;
    },
    userId: string,
  ) {
    // Check for duplicate detection unless confirmDuplicate flag is set
    if (!data.confirmDuplicate) {
      const potentialDuplicates = await prisma.employee.findMany({
        where: {
          legalFirstName: {
            equals: data.legalFirstName,
          },
          legalLastName: {
            equals: data.legalLastName,
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
          // Full prior values are carried so the rehire reconciliation panel can
          // compare typed-vs-existing for every field client-side (§4).
          matches: potentialDuplicates.map((emp) => ({
            id: emp.id,
            legalFirstName: emp.legalFirstName,
            legalLastName: emp.legalLastName,
            preferredFirstName: emp.preferredFirstName,
            preferredLastName: emp.preferredLastName,
            title: emp.title,
            department: emp.department || "Unknown",
            location: emp.location || "Unknown",
            departmentId: emp.departmentId,
            locationId: emp.locationId,
            status: emp.status,
            usi: emp.usi,
            notes: emp.notes,
            jobFamilyId: emp.jobFamilyId,
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
        legalFirstName: data.legalFirstName,
        legalLastName: data.legalLastName,
        // Default preferred names to the legal names when not supplied
        preferredFirstName: data.preferredFirstName ?? data.legalFirstName,
        preferredLastName: data.preferredLastName ?? data.legalLastName,
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
        employmentType: deriveEmploymentType((data.status ?? "Permanent") as EmployeeStatus),
        jobFamily: data.jobFamilyId ? { connect: { id: data.jobFamilyId } } : undefined,
      },
      include: {
        department: true,
        location: true,
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
          revision: true,
          training: {
            include: {
              revisions: {
                select: {
                  id: true,
                  effectiveDate: true,
                  createdAt: true,
                  overrideRequiresRetraining: true,
                },
              },
            },
          },
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

  /**
   * When an update flips an employee from active to inactive, enqueue the
   * ASSET_CHECKIN offboarding job (check their Snipe-IT assets back in via
   * AssetCheckout). Never lets an enqueue failure break the update that
   * already committed — the job can be raised manually if this ever fails.
   */
  private async enqueueOffboardingIfDeactivated(
    wasActive: boolean,
    isNowActive: boolean,
    employeeId: number,
  ): Promise<void> {
    if (!wasActive || isNowActive) return;
    try {
      await enqueue("ASSET_CHECKIN", { employeeId });
    } catch (err) {
      console.error(
        `Failed to enqueue ASSET_CHECKIN for employee ${employeeId}:`,
        err,
      );
    }
  }

  async updateEmployeePartial(
    employeeId: number,
    data: {
      legalFirstName?: string;
      legalLastName?: string;
      preferredFirstName?: string | null;
      preferredLastName?: string | null;
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
    if (data.legalFirstName !== undefined) updateData.legalFirstName = data.legalFirstName;
    if (data.legalLastName !== undefined) updateData.legalLastName = data.legalLastName;
    if (data.preferredFirstName !== undefined)
      updateData.preferredFirstName = data.preferredFirstName;
    if (data.preferredLastName !== undefined)
      updateData.preferredLastName = data.preferredLastName;
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

    await this.enqueueOffboardingIfDeactivated(
      currentEmployee.isActive,
      updatedEmployee.isActive,
      employeeId,
    );

    return updatedEmployee;
  }

  async updateEmployeeFull(
    employeeId: number,
    data: {
      legalFirstName: string;
      legalLastName: string;
      preferredFirstName?: string | null;
      preferredLastName?: string | null;
      title: string;
      startDate: string;
      finishDate?: string | null;
      departmentId: number;
      locationId: number;
      notes?: string | null;
      usi?: string | null;
      status?: string;
      isActive?: boolean;
      jobFamilyId?: number | null;
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
        legalFirstName: data.legalFirstName,
        legalLastName: data.legalLastName,
        preferredFirstName: data.preferredFirstName ?? data.legalFirstName,
        preferredLastName: data.preferredLastName ?? data.legalLastName,
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
        employmentType: deriveEmploymentType((data.status ?? "Permanent") as EmployeeStatus),
        jobFamily: data.jobFamilyId !== undefined
          ? (data.jobFamilyId ? { connect: { id: data.jobFamilyId } } : { disconnect: true })
          : undefined,
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

    await this.enqueueOffboardingIfDeactivated(
      currentEmployee.isActive,
      updatedEmployee.isActive,
      employeeId,
    );

    return updatedEmployee;
  }

  /**
   * Rehire a previously-departed employee (§3). Archives the prior stint as a
   * parseable `REHIRE` History row, then reactivates the live record with the
   * caller's already-reconciled field values. The server owns the archive
   * snapshot — `data` carries no snapshot/archive fields.
   */
  async rehireEmployee(
    employeeId: number,
    data: {
      startDate: string;
      priorFinishDate?: string | null;
      title: string;
      departmentId: number;
      locationId: number;
      status: string;
      jobFamilyId?: number | null;
      usi?: string | null;
      notes?: string | null;
      preferredFirstName?: string | null;
      preferredLastName?: string | null;
    },
    userId: string,
  ) {
    // 1. Load the existing record with the relations we snapshot names from.
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, location: true },
    });

    if (!existing) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    // 2. Only a departed employee can be rehired.
    if (existing.isActive) {
      throw new Error("ACTIVE_EMPLOYEE");
    }

    // 3. Resolve the prior stint's finish date (record's own, else supplied).
    const priorFinishDate = existing.finishDate
      ? existing.finishDate.toISOString()
      : data.priorFinishDate ?? null;
    if (!priorFinishDate) {
      throw new Error("MISSING_FINISH_DATE");
    }

    // 4. The new stint must start strictly after the prior one ends.
    const rehireStart = new Date(data.startDate);
    if (rehireStart <= new Date(priorFinishDate)) {
      throw new Error("INVALID_REHIRE_DATE");
    }

    const status = data.status as EmployeeStatus;
    const oldStint = serializePriorStint(existing, priorFinishDate);
    const newStint = {
      startDate: rehireStart.toISOString(),
      finishDate: null,
      title: data.title,
      departmentId: data.departmentId,
      locationId: data.locationId,
      status: data.status,
    };

    // 5. Archive + reactivate atomically.
    return prisma.$transaction(async (tx) => {
      await tx.history.create({
        data: {
          tableName: "Employee",
          recordId: String(employeeId),
          action: "REHIRE",
          oldValues: JSON.stringify(oldStint),
          newValues: JSON.stringify(newStint),
          // Full prior-record snapshot kept purely as an audit backup.
          changedFields: JSON.stringify(existing),
          userId,
        },
      });

      return tx.employee.update({
        where: { id: employeeId },
        data: {
          startDate: rehireStart,
          finishDate: null,
          isActive: true,
          hasPriorEmployment: true,
          title: data.title,
          department: { connect: { id: data.departmentId } },
          location: { connect: { id: data.locationId } },
          status,
          employmentType: deriveEmploymentType(status),
          jobFamily:
            data.jobFamilyId !== undefined
              ? data.jobFamilyId
                ? { connect: { id: data.jobFamilyId } }
                : { disconnect: true }
              : undefined,
          usi: data.usi,
          notes: data.notes,
          preferredFirstName: data.preferredFirstName,
          preferredLastName: data.preferredLastName,
        },
        include: {
          department: true,
          location: true,
        },
      });
    });
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
