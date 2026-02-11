import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma_client";
import { fileUploadService } from "./fileUploadService";

export interface GetTicketRecordsOptions {
  activeOnly?: boolean;
  includeExpired?: boolean;
  userRole: UserRole;
  userId: string;
}

export class TicketRecordService {
  private calculateExpiryDate(
    dateIssued: Date,
    renewalYears: number | null,
  ): Date | null {
    if (renewalYears === null) {
      return null;
    }

    const expiryDate = new Date(dateIssued);
    expiryDate.setFullYear(expiryDate.getFullYear() + renewalYears);
    expiryDate.setDate(expiryDate.getDate());

    return expiryDate;
  }

  async getTicketRecords(options: GetTicketRecordsOptions) {
    const { activeOnly, includeExpired, userRole, userId } = options;

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.ticket = {
        isActive: true,
      };
    }
    if (includeExpired) {
      whereClause.expiryDate = {
        gte: new Date(),
      };
    }

    const includeClause = {
      ticketHolder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: {
            select: {
              name: true,
            },
          },
          location: {
            select: {
              name: true,
              state: true,
            },
          },
        },
      },
      ticket: {
        select: {
          id: true,
          ticketCode: true,
          ticketName: true,
          renewal: true,
        },
      },
      images: true,
    };

    const orderBy = [
      { dateIssued: "desc" as const },
      { ticketHolder: { lastName: "asc" as const } },
    ];

    if (userRole === "Admin") {
      return await prisma.ticketRecords.findMany({
        where: whereClause,
        include: includeClause,
        orderBy,
      });
    } else if (userRole === "DepartmentManager") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { managedDepartments: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const departmentIds = user.managedDepartments.map((dept) => dept.id);

      const employees = await prisma.employee.findMany({
        where: {
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
      const employeeIds = employees.map((emp) => emp.id);

      return await prisma.ticketRecords.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...whereClause,
        },
        include: includeClause,
        orderBy,
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (!user || !user.employee) {
        throw new Error("NO_EMPLOYEE_RECORD");
      }

      return await prisma.ticketRecords.findMany({
        where: {
          employeeId: user.employee.id,
          ...whereClause,
        },
        include: includeClause,
        orderBy,
      });
    }
  }

  async getTicketRecordById(id: number) {
    const ticketRecord = await prisma.ticketRecords.findUnique({
      where: { id },
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
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
        },
        ticket: {
          select: {
            id: true,
            ticketCode: true,
            ticketName: true,
            renewal: true,
          },
        },
        images: true,
      },
    });

    if (!ticketRecord) {
      throw new Error("TICKET_RECORD_NOT_FOUND");
    }

    return ticketRecord;
  }

  async createTicketRecord(
    data: {
      employeeId: number;
      ticketId: number;
      dateIssued: string;
      licenseNumber?: string | null;
      expiryDate?: string | null;
      manualExpiryOverride?: boolean;
    },
    images: File[],
    userId: string,
  ) {
    if (!data.employeeId || !data.ticketId || !data.dateIssued) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    const issuedDate = new Date(data.dateIssued);

    const existingRecord = await prisma.ticketRecords.findFirst({
      where: {
        employeeId: data.employeeId,
        ticketId: data.ticketId,
        dateIssued: issuedDate,
      },
    });

    if (existingRecord) {
      throw new Error("DUPLICATE_TICKET_RECORD");
    }

    const [employee, ticket] = await Promise.all([
      prisma.employee.findUnique({ where: { id: data.employeeId } }),
      prisma.ticket.findUnique({ where: { id: data.ticketId } }),
    ]);

    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const savedImages = await fileUploadService.saveFiles(images, "tickets");

    let finalExpiryDate: Date | null = null;

    if (data.manualExpiryOverride && data.expiryDate) {
      finalExpiryDate = new Date(data.expiryDate);

      if (finalExpiryDate <= issuedDate) {
        throw new Error("INVALID_EXPIRY_DATE");
      }
    } else {
      finalExpiryDate = this.calculateExpiryDate(issuedDate, ticket.renewal);
    }

    if (ticket.renewal !== null && !finalExpiryDate) {
      throw new Error("EXPIRY_DATE_REQUIRED");
    }

    const ticketRecord = await prisma.ticketRecords.create({
      data: {
        employeeId: data.employeeId,
        ticketId: data.ticketId,
        dateIssued: issuedDate,
        expiryDate: finalExpiryDate,
        licenseNumber: data.licenseNumber || null,
        images: {
          create: savedImages.map((img) => ({
            imagePath: img.imagePath,
            imageType: img.imageType,
            originalName: img.originalName,
          })),
        },
      },
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                name: true,
              },
            },
            location: {
              select: {
                name: true,
                state: true,
              },
            },
          },
        },
        ticket: {
          select: {
            id: true,
            ticketCode: true,
            ticketName: true,
            renewal: true,
          },
        },
        images: true,
      },
    });

    const historyData = {
      ...ticketRecord,
      _metadata: {
        manualExpiryOverride: data.manualExpiryOverride,
        calculatedExpiryDate:
          ticket.renewal !== null
            ? this.calculateExpiryDate(issuedDate, ticket.renewal)?.toISOString() || null
            : null,
        finalExpiryDate: finalExpiryDate?.toISOString() || null,
      },
    };

    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: ticketRecord.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(historyData),
        userId,
      },
    });

    return ticketRecord;
  }

  async updateTicketRecord(
    id: number,
    data: {
      employeeId?: number;
      ticketId?: number;
      dateIssued?: string;
      licenseNumber?: string;
      expiryDate?: string | null;
      removedImageIds?: number[];
    },
    images: File[],
    userId: string,
  ) {
    const existingRecord = await prisma.ticketRecords.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      throw new Error("TICKET_RECORD_NOT_FOUND");
    }

    const finalEmployeeId = data.employeeId || existingRecord.employeeId;
    const finalTicketId = data.ticketId || existingRecord.ticketId;
    const finalDateIssued = data.dateIssued
      ? new Date(data.dateIssued)
      : existingRecord.dateIssued;

    let ticket = null;
    if (data.ticketId || data.dateIssued) {
      ticket = await prisma.ticket.findUnique({
        where: { id: finalTicketId },
      });

      if (!ticket) {
        throw new Error("TICKET_NOT_FOUND");
      }
    }

    let finalExpiryDate: Date | null = null;

    if (data.expiryDate) {
      finalExpiryDate = new Date(data.expiryDate);
    } else if (ticket) {
      finalExpiryDate = this.calculateExpiryDate(finalDateIssued, ticket.renewal);
    } else {
      finalExpiryDate = existingRecord.expiryDate;
    }

    if (ticket && ticket.renewal !== null && !finalExpiryDate) {
      throw new Error("EXPIRY_DATE_REQUIRED");
    }

    if (ticket && ticket.renewal && data.expiryDate === null) {
      finalExpiryDate = null;
    }

    // Check for duplicate if key fields are being changed
    const isUniqueFieldChanged =
      (data.employeeId && data.employeeId !== existingRecord.employeeId) ||
      (data.ticketId && data.ticketId !== existingRecord.ticketId) ||
      (data.dateIssued &&
        new Date(data.dateIssued).getTime() !== existingRecord.dateIssued.getTime());

    if (isUniqueFieldChanged) {
      const duplicateRecord = await prisma.ticketRecords.findFirst({
        where: {
          employeeId: finalEmployeeId,
          ticketId: finalTicketId,
          dateIssued: finalDateIssued,
          NOT: { id },
        },
      });

      if (duplicateRecord) {
        throw new Error("DUPLICATE_TICKET_RECORD");
      }
    }

    if (data.employeeId && data.employeeId !== existingRecord.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
      });
      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND");
      }
    }

    // Handle removed images
    if (data.removedImageIds && data.removedImageIds.length > 0) {
      const imagesToRemove = await prisma.ticketImage.findMany({
        where: {
          id: { in: data.removedImageIds },
        },
      });

      await fileUploadService.deleteFiles(
        imagesToRemove.map((img) => img.imagePath),
      );

      await prisma.ticketImage.deleteMany({
        where: {
          id: { in: data.removedImageIds },
        },
      });
    }

    // Handle new image uploads
    const savedImages = await fileUploadService.saveFiles(images, "tickets");

    const updatedRecord = await prisma.ticketRecords.update({
      where: { id },
      data: {
        employeeId: data.employeeId || undefined,
        ticketId: data.ticketId || undefined,
        dateIssued: data.dateIssued ? new Date(data.dateIssued) : undefined,
        expiryDate: finalExpiryDate,
        licenseNumber:
          data.licenseNumber !== undefined
            ? data.licenseNumber || null
            : undefined,
        ...(savedImages.length > 0 && {
          images: {
            create: savedImages.map((img) => ({
              imagePath: img.imagePath,
              imageType: img.imageType,
              originalName: img.originalName,
            })),
          },
        }),
      },
      include: {
        ticketHolder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
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
        },
        ticket: {
          select: {
            id: true,
            ticketCode: true,
            ticketName: true,
            renewal: true,
          },
        },
        images: true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: updatedRecord.id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(existingRecord),
        newValues: JSON.stringify(updatedRecord),
        userId,
      },
    });

    return updatedRecord;
  }

  async deleteTicketRecord(id: number, userId: string) {
    const existingRecord = await prisma.ticketRecords.findUnique({
      where: { id },
      include: {
        ticketHolder: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        ticket: {
          select: {
            ticketCode: true,
            ticketName: true,
          },
        },
        images: true,
      },
    });

    if (!existingRecord) {
      throw new Error("TICKET_RECORD_NOT_FOUND");
    }

    await prisma.ticketRecords.delete({
      where: { id },
    });

    if (existingRecord.images && existingRecord.images.length > 0) {
      await fileUploadService.deleteFiles(
        existingRecord.images.map((img) => img.imagePath),
      );
    }

    await prisma.history.create({
      data: {
        tableName: "TicketRecords",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingRecord),
        userId,
      },
    });

    return {
      message: "Ticket record deleted successfully",
      deletedRecord: {
        id: existingRecord.id,
        employee: `${existingRecord.ticketHolder.firstName} ${existingRecord.ticketHolder.lastName}`,
        ticket: `${existingRecord.ticket.ticketCode} - ${existingRecord.ticket.ticketName}`,
        dateIssued: existingRecord.dateIssued,
      },
    };
  }
}

export const ticketRecordService = new TicketRecordService();
