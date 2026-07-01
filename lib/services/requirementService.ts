import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getChildDepartmentIds } from "@/lib/apiRBAC";
import { UserRole } from "@/generated/prisma_client/client";
import { isTicketRecordValid } from "@/lib/services/ticketCompliance";
import { isTrainingSatisfied, type TrainingLite } from "@/lib/services/trainingCompliance";

export class RequirementService {
  /**
   * Returns null if the user can view all employees, or an array of accessible
   * employee IDs scoped to their role (dept manager → their depts; everyone else → self only).
   */
  private async getAccessibleEmployeeIds(
    userId: string,
    userRole: string,
  ): Promise<number[] | null> {
    const canViewAll = await auth.api.userHasPermission({
      body: {
        role: userRole as UserRole,
        permissions: { employee: ["viewAll"] },
      },
    });
    if (canViewAll.success) return null;

    const canViewDepartment = await auth.api.userHasPermission({
      body: {
        role: userRole as UserRole,
        permissions: { employee: ["viewDepartment"] },
      },
    });
    if (canViewDepartment.success) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });
      if (!user) return [];
      const deptIds = new Set<number>();
      for (const dept of user.managedDepartments) {
        deptIds.add(dept.id);
        if (dept.level === 0) {
          const childIds = await getChildDepartmentIds(dept.id);
          childIds.forEach((id) => deptIds.add(id));
        }
      }
      const employees = await prisma.employee.findMany({
        where: { departmentId: { in: Array.from(deptIds) } },
        select: { id: true },
      });
      return employees.map((e) => e.id);
    }

    // FireWarden, User — self only
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    if (!user?.employeeId) return [];
    return [user.employeeId];
  }

  async getEmployeeRequirements(employeeId: number) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    const whereClause = {
      OR: [
        {
          departmentId: employee.departmentId,
          locationId: employee.locationId,
        },
        { departmentId: -1, locationId: employee.locationId },
        { departmentId: employee.departmentId, locationId: -1 },
        { departmentId: -1, locationId: -1 },
      ],
    };

    const [
      allTrainingRequirements,
      allTicketRequirements,
      exemptions,
      trainingRecords,
      ticketRecords,
    ] = await Promise.all([
      prisma.trainingRequirement.findMany({
        where: whereClause,
        include: {
          training: true,
          department: true,
          location: true,
        },
      }),
      prisma.ticketRequirement.findMany({
        where: whereClause,
        include: {
          ticket: true,
          department: true,
          location: true,
        },
      }),
      prisma.trainingTicketExemption.findMany({
        where: { employeeId, status: "Active" },
        include: {
          training: true,
          ticket: true,
        },
      }),
      prisma.trainingRecords.findMany({
        where: { employeeId },
      }),
      prisma.ticketRecords.findMany({
        where: { employeeId },
      }),
    ]);

    const now = new Date();

    // Group training records by trainingId for revision-aware compliance check
    const recordsByTraining = new Map<number, { revisionId: number | null }[]>();
    for (const r of trainingRecords) {
      const list = recordsByTraining.get(r.trainingId) ?? [];
      list.push(r);
      recordsByTraining.set(r.trainingId, list);
    }
    // Fetch revision data for all training types that have records
    const trainingIdsWithRecords = [...recordsByTraining.keys()];
    const trainingsWithRevisions = trainingIdsWithRecords.length > 0
      ? await prisma.training.findMany({
          where: { id: { in: trainingIdsWithRecords } },
          select: {
            id: true,
            requiresRetrainingOnRevision: true,
            revisions: { select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true } },
          },
        })
      : [];
    const trainingMap = new Map<number, TrainingLite>(trainingsWithRevisions.map((t) => [t.id, t]));
    const completedTrainingIds = new Set(
      [...recordsByTraining.entries()]
        .filter(([trainingId, recs]) => {
          const t = trainingMap.get(trainingId);
          return t ? isTrainingSatisfied(recs, t, now) : recs.length > 0;
        })
        .map(([trainingId]) => trainingId),
    );

    const completedTicketIds = new Set(
      ticketRecords.filter((r) => isTicketRecordValid(r, now)).map((r) => r.ticketId),
    );
    const exemptedTrainingIds = new Set(
      exemptions
        .filter((e) => e.type === "Training" && e.trainingId != null)
        .map((e) => e.trainingId!),
    );
    const exemptedTicketIds = new Set(
      exemptions
        .filter((e) => e.type === "Ticket" && e.ticketId != null)
        .map((e) => e.ticketId!),
    );

    const trainingRequired = allTrainingRequirements.filter(
      (req) =>
        !completedTrainingIds.has(req.trainingId) &&
        !exemptedTrainingIds.has(req.trainingId),
    );
    const ticketRequired = allTicketRequirements.filter(
      (req) =>
        !completedTicketIds.has(req.ticketId) &&
        !exemptedTicketIds.has(req.ticketId),
    );

    return {
      allTrainingRequirements,
      allTicketRequirements,
      exemptions,
      trainingRequired,
      ticketRequired,
    };
  }

  async getTrainingRequirements(
    trainingId: number,
    userId: string,
    userRole: string,
  ) {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
    });

    if (!training) {
      throw new Error("TRAINING_NOT_FOUND");
    }

    const requirements = await prisma.trainingRequirement.findMany({
      where: { trainingId },
      include: {
        department: true,
        location: true,
      },
    });

    if (!requirements || requirements.length === 0) {
      throw new Error("NO_REQUIREMENTS_FOUND");
    }

    const accessibleIds = await this.getAccessibleEmployeeIds(userId, userRole);

    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(accessibleIds !== null && { id: { in: accessibleIds } }),
      },
      include: {
        department: true,
        location: true,
      },
    });

    const requiredEmployees = allEmployees.filter((employee) => {
      return requirements.some((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;
        return deptMatches && locMatches;
      });
    });

    const trainingRecords = await prisma.trainingRecords.findMany({
      where: {
        trainingId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
    });

    const exemptions = await prisma.trainingTicketExemption.findMany({
      where: {
        trainingId,
        status: "Active",
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    const now = new Date();
    const ruleTrainings = await prisma.training.findMany({
      where: { id: { in: [trainingId] } },
      select: {
        id: true,
        requiresRetrainingOnRevision: true,
        revisions: { select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true } },
      },
    });
    const ruleTraining = ruleTrainings[0] as TrainingLite | undefined;
    const recordsByEmployee = new Map<number, { revisionId: number | null }[]>();
    for (const r of trainingRecords) {
      const list = recordsByEmployee.get(r.employeeId) ?? [];
      list.push(r);
      recordsByEmployee.set(r.employeeId, list);
    }
    const completedEmployeeIds = new Set(
      [...recordsByEmployee.entries()]
        .filter(([, recs]) => (ruleTraining ? isTrainingSatisfied(recs, ruleTraining, now) : recs.length > 0))
        .map(([employeeId]) => employeeId),
    );

    const exemptEmployeeIds = new Set(
      exemptions.map((exemption) => exemption.employeeId),
    );

    const employeesWithStatus = requiredEmployees.map((emp) => {
      let requirementStatus: "Required" | "Exempted" | "Completed";

      if (exemptEmployeeIds.has(emp.id)) {
        requirementStatus = "Exempted";
      } else if (completedEmployeeIds.has(emp.id)) {
        requirementStatus = "Completed";
      } else {
        requirementStatus = "Required";
      }

      return {
        ...emp,
        requirementStatus,
      };
    });

    return {
      employees: employeesWithStatus,
    };
  }

  async getTicketRequirements(
    ticketId: number,
    userId: string,
    userRole: string,
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const requirements = await prisma.ticketRequirement.findMany({
      where: { ticketId },
      include: {
        department: true,
        location: true,
      },
    });

    if (!requirements || requirements.length === 0) {
      throw new Error("NO_REQUIREMENTS_FOUND");
    }

    const accessibleIds = await this.getAccessibleEmployeeIds(userId, userRole);

    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(accessibleIds !== null && { id: { in: accessibleIds } }),
      },
      include: {
        department: true,
        location: true,
      },
    });

    const requiredEmployees = allEmployees.filter((employee) => {
      return requirements.some((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;
        return deptMatches && locMatches;
      });
    });

    const ticketRecords = await prisma.ticketRecords.findMany({
      where: {
        ticketId,
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
    });

    const exemptions = await prisma.trainingTicketExemption.findMany({
      where: {
        ticketId,
        status: "Active",
        employeeId: { in: requiredEmployees.map((emp) => emp.id) },
      },
      include: {
        employee: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    const now = new Date();
    const completedEmployeeIds = new Set(
      ticketRecords
        .filter((record) => isTicketRecordValid(record, now))
        .map((record) => record.employeeId),
    );

    const exemptEmployeeIds = new Set(
      exemptions.map((exemption) => exemption.employeeId),
    );

    const employeesWithStatus = requiredEmployees.map((emp) => {
      let requirementStatus: "Required" | "Exempted" | "Completed";

      if (exemptEmployeeIds.has(emp.id)) {
        requirementStatus = "Exempted";
      } else if (completedEmployeeIds.has(emp.id)) {
        requirementStatus = "Completed";
      } else {
        requirementStatus = "Required";
      }

      return {
        ...emp,
        requirementStatus,
      };
    });

    return {
      employees: employeesWithStatus,
    };
  }

  async getDepartmentLocationRequirements(
    departmentId: number,
    locationId: number,
  ) {
    const buildWhereClause = (deptId: number, locId: number) => {
      const conditions = [];

      if (deptId === -1 && locId === -1) {
        return {};
      } else if (deptId === -1) {
        conditions.push(
          { departmentId: -1, locationId: locId },
          { departmentId: -1, locationId: -1 },
        );
      } else if (locId === -1) {
        conditions.push(
          { departmentId: deptId, locationId: -1 },
          { departmentId: -1, locationId: -1 },
        );
      } else {
        conditions.push(
          { departmentId: deptId, locationId: locId },
          { departmentId: -1, locationId: locId },
          { departmentId: deptId, locationId: -1 },
          { departmentId: -1, locationId: -1 },
        );
      }

      return { OR: conditions };
    };

    const whereClause = buildWhereClause(departmentId, locationId);

    const validationPromises = [];

    if (departmentId !== -1) {
      validationPromises.push(
        prisma.department.findUnique({
          where: { id: departmentId },
        }),
      );
    } else {
      validationPromises.push(Promise.resolve(true));
    }

    if (locationId !== -1) {
      validationPromises.push(
        prisma.location.findUnique({
          where: { id: locationId },
        }),
      );
    } else {
      validationPromises.push(Promise.resolve(true));
    }

    const [department, location] = await Promise.all(validationPromises);

    if (departmentId !== -1 && !department) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }

    if (locationId !== -1 && !location) {
      throw new Error("LOCATION_NOT_FOUND");
    }

    const [trainingRequirements, ticketRequirements] = await Promise.all([
      prisma.trainingRequirement.findMany({
        where: whereClause,
        include: {
          training: true,
          department: true,
          location: true,
        },
      }),
      prisma.ticketRequirement.findMany({
        where: whereClause,
        include: {
          ticket: true,
          department: true,
          location: true,
        },
      }),
    ]);

    return {
      trainingRequirements,
      ticketRequirements,
      filters: {
        departmentId: departmentId === -1 ? "all" : departmentId,
        locationId: locationId === -1 ? "all" : locationId,
      },
    };
  }

  async getAllIncompleteTrainingRequirements(userId: string, userRole: string) {
    const allRequirements = await prisma.trainingRequirement.findMany({
      include: {
        training: true,
        department: true,
        location: true,
      },
    });

    if (allRequirements.length === 0) {
      return { employees: [], totalRows: 0, uniqueEmployees: 0 };
    }

    const trainingIds = [...new Set(allRequirements.map((r) => r.trainingId))];
    const accessibleIds = await this.getAccessibleEmployeeIds(userId, userRole);

    const [allEmployees, allTrainingRecords, allExemptions] = await Promise.all(
      [
        prisma.employee.findMany({
          where: {
            isActive: true,
            ...(accessibleIds !== null && { id: { in: accessibleIds } }),
          },
          include: {
            department: true,
            location: true,
          },
        }),
        prisma.trainingRecords.findMany({
          where: { trainingId: { in: trainingIds } },
        }),
        prisma.trainingTicketExemption.findMany({
          where: { trainingId: { in: trainingIds }, status: "Active" },
        }),
      ],
    );

    const now = new Date();
    const ruleTrainings = await prisma.training.findMany({
      where: { id: { in: trainingIds } },
      select: {
        id: true,
        requiresRetrainingOnRevision: true,
        revisions: { select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true } },
      },
    });
    const ruleMap = new Map<number, TrainingLite>(ruleTrainings.map((t) => [t.id, t]));

    // Group records by (employee, training) pair for revision-aware compliance check
    const recsByPair = new Map<string, { revisionId: number | null }[]>();
    for (const r of allTrainingRecords) {
      const key = `${r.employeeId}:${r.trainingId}`;
      const list = recsByPair.get(key) ?? [];
      list.push(r);
      recsByPair.set(key, list);
    }
    const completedMap = new Map<number, Set<number>>();
    for (const [key, recs] of recsByPair) {
      const [empIdStr, trainingIdStr] = key.split(":");
      const empId = Number(empIdStr);
      const tId = Number(trainingIdStr);
      const t = ruleMap.get(tId);
      if (!(t ? isTrainingSatisfied(recs, t, now) : recs.length > 0)) continue;
      if (!completedMap.has(empId)) completedMap.set(empId, new Set());
      completedMap.get(empId)!.add(tId);
    }

    const exemptionMap = new Map<number, Set<number>>();
    allExemptions.forEach((exemption) => {
      if (exemption.trainingId) {
        if (!exemptionMap.has(exemption.employeeId)) {
          exemptionMap.set(exemption.employeeId, new Set());
        }
        exemptionMap.get(exemption.employeeId)!.add(exemption.trainingId);
      }
    });

    // Build a Map<trainingId, requirement> for O(1) lookup when building rows
    const requirementByTrainingId = new Map(
      allRequirements.map((req) => [req.trainingId, req]),
    );

    const rows: {
      employeeId: number;
      legalFirstName: string;
      legalLastName: string;
      department: (typeof allEmployees)[0]["department"];
      location: (typeof allEmployees)[0]["location"];
      trainingName: string | undefined;
    }[] = [];

    allEmployees.forEach((employee) => {
      const requiredTrainingIds = new Set<number>();

      allRequirements.forEach((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        if (deptMatches && locMatches) {
          requiredTrainingIds.add(req.trainingId);
        }
      });

      const incompleteTraining = Array.from(requiredTrainingIds).filter(
        (trainingId) => {
          const isCompleted =
            completedMap.get(employee.id)?.has(trainingId) ?? false;
          const isExempt =
            exemptionMap.get(employee.id)?.has(trainingId) ?? false;
          return !isCompleted && !isExempt;
        },
      );

      incompleteTraining.forEach((trainingId) => {
        const requirement = requirementByTrainingId.get(trainingId);
        rows.push({
          employeeId: employee.id,
          legalFirstName: employee.legalFirstName,
          legalLastName: employee.legalLastName,
          department: employee.department,
          location: employee.location,
          trainingName: requirement?.training.title,
        });
      });
    });

    return {
      employees: rows,
      totalRows: rows.length,
      uniqueEmployees: new Set(rows.map((r) => r.employeeId)).size,
    };
  }

  async getAllIncompleteTicketRequirements(userId: string, userRole: string) {
    const allRequirements = await prisma.ticketRequirement.findMany({
      include: {
        ticket: true,
        department: true,
        location: true,
      },
    });

    if (allRequirements.length === 0) {
      return { employees: [], totalRows: 0, uniqueEmployees: 0 };
    }

    const ticketIds = [...new Set(allRequirements.map((r) => r.ticketId))];
    const accessibleIds = await this.getAccessibleEmployeeIds(userId, userRole);

    const [allEmployees, allTicketRecords, allExemptions] = await Promise.all([
      prisma.employee.findMany({
        where: {
          isActive: true,
          ...(accessibleIds !== null && { id: { in: accessibleIds } }),
        },
        include: {
          department: true,
          location: true,
        },
      }),
      prisma.ticketRecords.findMany({
        where: { ticketId: { in: ticketIds } },
      }),
      prisma.trainingTicketExemption.findMany({
        where: { ticketId: { in: ticketIds }, status: "Active" },
      }),
    ]);

    const now = new Date();
    const completedMap = new Map<number, Set<number>>();
    allTicketRecords.forEach((record) => {
      if (!isTicketRecordValid(record, now)) return; // expired records don't satisfy (spec §5.2)
      if (!completedMap.has(record.employeeId)) {
        completedMap.set(record.employeeId, new Set());
      }
      completedMap.get(record.employeeId)!.add(record.ticketId);
    });

    const exemptionMap = new Map<number, Set<number>>();
    allExemptions.forEach((exemption) => {
      if (exemption.ticketId) {
        if (!exemptionMap.has(exemption.employeeId)) {
          exemptionMap.set(exemption.employeeId, new Set());
        }
        exemptionMap.get(exemption.employeeId)!.add(exemption.ticketId);
      }
    });

    // Build a Map<ticketId, requirement> for O(1) lookup when building rows
    const requirementByTicketId = new Map(
      allRequirements.map((req) => [req.ticketId, req]),
    );

    const rows: {
      employeeId: number;
      legalFirstName: string;
      legalLastName: string;
      department: (typeof allEmployees)[0]["department"];
      location: (typeof allEmployees)[0]["location"];
      ticketName: string | undefined;
    }[] = [];

    allEmployees.forEach((employee) => {
      const requiredTicketIds = new Set<number>();

      allRequirements.forEach((req) => {
        const deptMatches =
          req.departmentId === -1 || req.departmentId === employee.departmentId;
        const locMatches =
          req.locationId === -1 || req.locationId === employee.locationId;

        if (deptMatches && locMatches) {
          requiredTicketIds.add(req.ticketId);
        }
      });

      const incompleteTickets = Array.from(requiredTicketIds).filter(
        (ticketId) => {
          const isCompleted =
            completedMap.get(employee.id)?.has(ticketId) ?? false;
          const isExempt =
            exemptionMap.get(employee.id)?.has(ticketId) ?? false;
          return !isCompleted && !isExempt;
        },
      );

      incompleteTickets.forEach((ticketId) => {
        const requirement = requirementByTicketId.get(ticketId);
        rows.push({
          employeeId: employee.id,
          legalFirstName: employee.legalFirstName,
          legalLastName: employee.legalLastName,
          department: employee.department,
          location: employee.location,
          ticketName: requirement?.ticket.ticketName,
        });
      });
    });

    return {
      employees: rows,
      totalRows: rows.length,
      uniqueEmployees: new Set(rows.map((r) => r.employeeId)).size,
    };
  }

  async getDeliveredTrainingTracker(userId: string, userRole: string) {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "internallyDeliveredTrainingIds" },
    });
    const curatedIds: number[] = setting?.value ? JSON.parse(setting.value) : [];

    if (curatedIds.length === 0) {
      return { courses: [], rows: [] };
    }

    const courses = await prisma.training.findMany({
      where: { id: { in: curatedIds }, isActive: true },
      select: { id: true, title: true },
    });

    if (courses.length === 0) {
      return { courses: [], rows: [] };
    }

    const activeCuratedIds = courses.map((c) => c.id);
    const accessibleIds = await this.getAccessibleEmployeeIds(userId, userRole);

    const [
      allEmployees,
      allRequirements,
      allTrainingRecords,
      allExemptions,
      allOnboardingRequests,
    ] = await Promise.all([
      prisma.employee.findMany({
        where: {
          isActive: true,
          ...(accessibleIds !== null && { id: { in: accessibleIds } }),
        },
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          departmentId: true,
          locationId: true,
        },
      }),
      prisma.trainingRequirement.findMany({
        where: { trainingId: { in: activeCuratedIds } },
      }),
      prisma.trainingRecords.findMany({
        where: { trainingId: { in: activeCuratedIds } },
        select: { employeeId: true, trainingId: true, revisionId: true },
      }),
      prisma.trainingTicketExemption.findMany({
        where: { trainingId: { in: activeCuratedIds }, status: "Active" },
        select: { employeeId: true, trainingId: true },
      }),
      prisma.onboardingRequest.findMany({
        where: { status: "Approved", createdEmployeeId: { not: null } },
        select: { createdEmployeeId: true },
      }),
    ]);

    const now = new Date();
    const ruleTrainings = await prisma.training.findMany({
      where: { id: { in: activeCuratedIds } },
      select: {
        id: true,
        requiresRetrainingOnRevision: true,
        revisions: { select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true } },
      },
    });
    const ruleMap = new Map<number, TrainingLite>(ruleTrainings.map((t) => [t.id, t]));

    const recsByPair = new Map<string, { revisionId: number | null }[]>();
    for (const r of allTrainingRecords) {
      const key = `${r.employeeId}:${r.trainingId}`;
      const list = recsByPair.get(key) ?? [];
      list.push(r);
      recsByPair.set(key, list);
    }
    const completedMap = new Map<number, Set<number>>();
    for (const [key, recs] of recsByPair) {
      const [empIdStr, trainingIdStr] = key.split(":");
      const empId = Number(empIdStr);
      const tId = Number(trainingIdStr);
      const t = ruleMap.get(tId);
      if (!(t ? isTrainingSatisfied(recs, t, now) : recs.length > 0)) continue;
      if (!completedMap.has(empId)) completedMap.set(empId, new Set());
      completedMap.get(empId)!.add(tId);
    }

    const exemptionMap = new Map<number, Set<number>>();
    allExemptions.forEach((e) => {
      if (e.trainingId === null) return;
      if (!exemptionMap.has(e.employeeId)) exemptionMap.set(e.employeeId, new Set());
      exemptionMap.get(e.employeeId)!.add(e.trainingId);
    });

    const newStarterIds = new Set(
      allOnboardingRequests
        .map((r) => r.createdEmployeeId)
        .filter((id): id is number => id !== null),
    );

    const rows: {
      employee: { id: number; legalFirstName: string; legalLastName: string };
      isNewStarter: boolean;
      cells: { trainingId: number; status: "done" | "outstanding" | "na" }[];
    }[] = [];

    for (const employee of allEmployees) {
      const cells = courses.map((course) => {
        if (completedMap.get(employee.id)?.has(course.id)) {
          return { trainingId: course.id, status: "done" as const };
        }

        const isRequired = allRequirements.some((req) => {
          if (req.trainingId !== course.id) return false;
          const deptMatch =
            req.departmentId === -1 || req.departmentId === employee.departmentId;
          const locMatch =
            req.locationId === -1 || req.locationId === employee.locationId;
          return deptMatch && locMatch;
        });

        if (!isRequired) return { trainingId: course.id, status: "na" as const };

        const isExempt = exemptionMap.get(employee.id)?.has(course.id) ?? false;
        if (isExempt) return { trainingId: course.id, status: "na" as const };

        return { trainingId: course.id, status: "outstanding" as const };
      });

      if (!cells.some((c) => c.status === "outstanding")) continue;

      rows.push({
        employee: {
          id: employee.id,
          legalFirstName: employee.legalFirstName,
          legalLastName: employee.legalLastName,
        },
        isNewStarter: newStarterIds.has(employee.id),
        cells,
      });
    }

    rows.sort((a, b) => {
      if (a.isNewStarter !== b.isNewStarter) return a.isNewStarter ? -1 : 1;
      const last = a.employee.legalLastName.localeCompare(b.employee.legalLastName);
      if (last !== 0) return last;
      return a.employee.legalFirstName.localeCompare(b.employee.legalFirstName);
    });

    return { courses, rows };
  }
}

export const requirementService = new RequirementService();
