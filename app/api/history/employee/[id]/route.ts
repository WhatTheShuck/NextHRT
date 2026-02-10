import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client";
import { hasAccessToEmployee } from "@/lib/apiRBAC";

// GET history records for a specific employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const userRole = session.user.role as UserRole;
  const employeeId = parseInt(id);

  try {
    // Check if user has access to this employee
    const hasAccess = await hasAccessToEmployee(userId, employeeId, userRole);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorised to view this employee's history" },
        { status: 403 },
      );
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const includeOrphaned = searchParams.get("includeOrphaned") === "true";

    // Initialize variables at function scope
    let historyRecords: any[] = [];
    let totalCount: number = 0;

    if (includeOrphaned) {
      // Comprehensive search including deleted records (slower)

      // Get current training and ticket record IDs
      const currentTrainingRecords = await prisma.trainingRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      const currentTicketRecords = await prisma.ticketRecords.findMany({
        where: { employeeId },
        select: { id: true },
      });

      // Get all history records that might be related to this employee
      const allHistory = await prisma.history.findMany({
        where: {
          OR: [
            // Direct employee record changes
            {
              tableName: "Employee",
              recordId: employeeId.toString(),
            },
            // Current training records
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
            // Current ticket records
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
            // All training records (to catch deleted ones)
            {
              tableName: "TrainingRecords",
            },
            // All ticket records (to catch deleted ones)
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

      // Filter records to only include those related to this employee
      const filteredHistory = allHistory.filter((record) => {
        // Always include direct employee records
        if (
          record.tableName === "Employee" &&
          record.recordId === employeeId.toString()
        ) {
          return true;
        }

        // For training and ticket records, check if they belong to this employee
        if (
          record.tableName === "TrainingRecords" ||
          record.tableName === "TicketRecords"
        ) {
          // Check current records first
          const isCurrentRecord =
            record.tableName === "TrainingRecords"
              ? currentTrainingRecords.some(
                  (tr) => tr.id.toString() === record.recordId,
                )
              : currentTicketRecords.some(
                  (tr) => tr.id.toString() === record.recordId,
                );

          if (isCurrentRecord) return true;

          // For potentially deleted records, check oldValues and newValues
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
            return false; // Skip records with invalid JSON
          }
        }

        return false;
      });

      // Apply action filter if provided
      const actionFiltered = action
        ? filteredHistory.filter((record) => record.action === action)
        : filteredHistory;

      // Apply pagination
      const offsetNum = offset ? parseInt(offset) : 0;
      const limitNum = limit ? parseInt(limit) : undefined;

      historyRecords = limitNum
        ? actionFiltered.slice(offsetNum, offsetNum + limitNum)
        : actionFiltered.slice(offsetNum);

      totalCount = actionFiltered.length;
    } else {
      // Fast search - only current records (default)

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
          // Only include current training records
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
          // Only include current ticket records
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

      // Add action filter if provided
      if (action) {
        whereClause.action = action;
      }

      // Get paginated results
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
        take: limit ? parseInt(limit) : undefined,
        skip: offset ? parseInt(offset) : undefined,
      });

      // Get total count
      totalCount = await prisma.history.count({
        where: whereClause,
      });
    }

    const offsetNum = offset ? parseInt(offset) : 0;
    const limitNum = limit ? parseInt(limit) : undefined;
    const hasMore = limitNum ? totalCount > offsetNum + limitNum : false;

    return NextResponse.json({
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
      data: historyRecords,
      totalCount,
      hasMore,
      includeOrphaned,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching employee history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
