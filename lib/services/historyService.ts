import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { UserRole } from "@/generated/prisma_client";

export interface GetHistoryOptions {
  tableName?: string | null;
  recordId?: string | null;
  action?: string | null;
  limit?: number | null;
  offset?: number | null;
  userId: string;
  userRole: string;
}

export interface GetEmployeeHistoryOptions {
  employeeId: number;
  action?: string | null;
  limit?: number | null;
  offset?: number | null;
  includeOrphaned?: boolean;
}

export class HistoryService {
  async getHistory(options: GetHistoryOptions) {
    const { tableName, recordId, action, limit, offset, userId, userRole } =
      options;

    const whereClause: any = {};

    if (tableName) {
      whereClause.tableName = tableName;
    }

    if (recordId) {
      whereClause.recordId = recordId;
    }

    if (action) {
      whereClause.action = action;
    }

    const isDepartmentScoped = await auth.api.userHasPermission({
      body: {
        role: userRole as UserRole,
        permissions: { employee: ["viewDepartment"] },
      },
    });
    const isUnrestricted = await auth.api.userHasPermission({
      body: { role: userRole as UserRole, permissions: { employee: ["viewAll"] } },
    });

    if (isDepartmentScoped && !isUnrestricted) {
      const managedDepartments = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          managedDepartments: true,
        },
      });

      if (!managedDepartments?.managedDepartments.length) {
        throw new Error("NO_MANAGED_DEPARTMENTS");
      }

      if (!tableName || tableName === "Employee") {
        const managedEmployeeIds = await prisma.employee.findMany({
          where: {
            departmentId: {
              in: managedDepartments.managedDepartments.map((dept) => dept.id),
            },
          },
          select: { id: true },
        });

        const employeeIdStrings = managedEmployeeIds.map((emp) =>
          emp.id.toString(),
        );

        if (tableName === "Employee" || !tableName) {
          whereClause.AND = [
            whereClause,
            {
              OR: [
                {
                  tableName: { not: "Employee" },
                },
                {
                  AND: [
                    { tableName: "Employee" },
                    { recordId: { in: employeeIdStrings } },
                  ],
                },
              ],
            },
          ];
        }
      }
    }

    const history = await prisma.history.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit ?? undefined,
      skip: offset ?? undefined,
    });

    const totalCount = await prisma.history.count({
      where: whereClause,
    });

    return {
      data: history,
      totalCount,
      hasMore: limit ? totalCount > limit + (offset || 0) : false,
    };
  }

  async getEmployeeHistory(options: GetEmployeeHistoryOptions) {
    const { employeeId, action, limit, offset, includeOrphaned } = options;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    let historyRecords: any[] = [];
    let totalCount: number = 0;

    if (includeOrphaned) {
      const currentTrainingRecords = await prisma.trainingRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      const currentTicketRecords = await prisma.ticketRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      const allHistory = await prisma.history.findMany({
        where: {
          OR: [
            {
              tableName: "Employee",
              recordId: employeeId.toString(),
            },
            ...(currentTrainingRecords.length > 0
              ? [
                  {
                    tableName: "TrainingRecords",
                    recordId: {
                      in: currentTrainingRecords.map((tr) => tr.id.toString()),
                    },
                  },
                ]
              : []),
            ...(currentTicketRecords.length > 0
              ? [
                  {
                    tableName: "TicketRecords",
                    recordId: {
                      in: currentTicketRecords.map((tr) => tr.id.toString()),
                    },
                  },
                ]
              : []),
            {
              tableName: "TrainingRecords",
            },
            {
              tableName: "TicketRecords",
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      const filteredHistory = allHistory.filter((record) => {
        if (
          record.tableName === "Employee" &&
          record.recordId === employeeId.toString()
        ) {
          return true;
        }

        if (
          record.tableName === "TrainingRecords" ||
          record.tableName === "TicketRecords"
        ) {
          const isCurrentRecord =
            record.tableName === "TrainingRecords"
              ? currentTrainingRecords.some(
                  (tr) => tr.id.toString() === record.recordId,
                )
              : currentTicketRecords.some(
                  (tr) => tr.id.toString() === record.recordId,
                );

          if (isCurrentRecord) return true;

          try {
            const oldData = record.oldValues
              ? JSON.parse(record.oldValues)
              : null;
            const newData = record.newValues
              ? JSON.parse(record.newValues)
              : null;

            return (
              oldData?.employeeId === employeeId ||
              newData?.employeeId === employeeId
            );
          } catch {
            return false;
          }
        }

        return false;
      });

      const actionFiltered = action
        ? filteredHistory.filter((record) => record.action === action)
        : filteredHistory;

      const offsetNum = offset || 0;
      const limitNum = limit ?? undefined;

      historyRecords = limitNum
        ? actionFiltered.slice(offsetNum, offsetNum + limitNum)
        : actionFiltered.slice(offsetNum);

      totalCount = actionFiltered.length;
    } else {
      const currentTrainingRecords = await prisma.trainingRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      const currentTicketRecords = await prisma.ticketRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      const whereClause: any = {
        OR: [
          {
            tableName: "Employee",
            recordId: employeeId.toString(),
          },
          ...(currentTrainingRecords.length > 0
            ? [
                {
                  tableName: "TrainingRecords",
                  recordId: {
                    in: currentTrainingRecords.map((tr) => tr.id.toString()),
                  },
                },
              ]
            : []),
          ...(currentTicketRecords.length > 0
            ? [
                {
                  tableName: "TicketRecords",
                  recordId: {
                    in: currentTicketRecords.map((tr) => tr.id.toString()),
                  },
                },
              ]
            : []),
        ],
      };

      if (action) {
        whereClause.action = action;
      }

      historyRecords = await prisma.history.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: limit ?? undefined,
        skip: offset ?? undefined,
      });

      totalCount = await prisma.history.count({
        where: whereClause,
      });
    }

    const offsetNum = offset || 0;
    const limitNum = limit ?? undefined;
    const hasMore = limitNum ? totalCount > offsetNum + limitNum : false;

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
      data: historyRecords,
      totalCount,
      hasMore,
      includeOrphaned,
    };
  }
}

export const historyService = new HistoryService();
