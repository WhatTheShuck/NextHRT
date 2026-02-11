import prisma from "@/lib/prisma";

export interface GetTicketsOptions {
  activeOnly?: boolean;
  includeRequirements?: boolean;
}

export interface GetTicketByIdOptions {
  activeOnly?: boolean;
  expirationDays?: number | null;
  includeRequirements?: boolean;
}

export class TicketService {
  async getTickets(options: GetTicketsOptions) {
    const { activeOnly, includeRequirements } = options;

    const whereClause: any = {};
    if (activeOnly) {
      whereClause.isActive = true;
    }

    const includeClause: any = {
      _count: {
        select: { ticketRecords: true },
      },
    };

    if (includeRequirements) {
      includeClause.requirements = {
        include: {
          ticket: true,
          department: true,
          location: true,
        },
      };
      includeClause.ticketExemptions = {
        include: {
          ticket: true,
          employee: true,
        },
      };
    }

    const tickets = await prisma.ticket.findMany({
      include: includeClause,
      where: whereClause,
      orderBy: {
        ticketName: "asc",
      },
    });

    return tickets;
  }

  async getTicketById(id: number, options: GetTicketByIdOptions) {
    const { activeOnly, expirationDays, includeRequirements } = options;

    const whereClause: any = {};
    if (expirationDays !== null && expirationDays !== undefined) {
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + expirationDays);

      whereClause.expiryDate = {
        gt: now,
        lte: cutoffDate,
        not: null,
      };
    }
    if (activeOnly) {
      whereClause.ticketHolder = {
        isActive: true,
      };
    }

    const includeClause: any = {
      ticketRecords: {
        where: whereClause,
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
                },
              },
            },
          },
        },
        orderBy: {
          dateIssued: "desc",
        },
      },
      _count: {
        select: {
          ticketRecords: true,
        },
      },
    };

    if (includeRequirements) {
      includeClause.requirements = {
        include: {
          ticket: true,
          department: true,
          location: true,
        },
      };
      includeClause.ticketExemptions = {
        include: {
          ticket: true,
          employee: true,
        },
      };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: includeClause,
    });

    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    return ticket;
  }

  async createTicket(
    data: {
      ticketCode: string;
      ticketName: string;
      renewal?: number | null;
      requirements?: Array<{ departmentId: number; locationId: number }>;
    },
    userId: string,
  ) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketCode: data.ticketCode,
        ticketName: data.ticketName,
        renewal: data.renewal ?? null,
      },
    });

    if (data.requirements) {
      for (const req of data.requirements) {
        await prisma.ticketRequirement.create({
          data: {
            ticketId: ticket.id,
            departmentId: req.departmentId,
            locationId: req.locationId,
          },
        });
      }
    }

    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: ticket.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(ticket),
        userId,
      },
    });

    return ticket;
  }

  async updateTicket(
    id: number,
    data: {
      ticketCode: string;
      ticketName: string;
      renewal?: number | null;
      isActive?: boolean;
      requirements?: Array<{ departmentId: number; locationId: number }>;
    },
    userId: string,
  ) {
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ticketCode: data.ticketCode,
        ticketName: data.ticketName,
        renewal: data.renewal,
        isActive: data.isActive,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: updatedTicket.id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(existingTicket),
        newValues: JSON.stringify(updatedTicket),
        userId,
      },
    });

    if (data.requirements) {
      await prisma.ticketRequirement.deleteMany({
        where: { ticketId: id },
      });

      for (const req of data.requirements) {
        await prisma.ticketRequirement.create({
          data: {
            ticketId: updatedTicket.id,
            departmentId: req.departmentId,
            locationId: req.locationId,
          },
        });
      }
    }

    return updatedTicket;
  }

  async deleteTicket(id: number, userId: string) {
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ticketRecords: true,
          },
        },
      },
    });

    if (!existingTicket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    if (existingTicket._count.ticketRecords > 0) {
      throw new Error("TICKET_HAS_RECORDS");
    }

    await prisma.ticket.delete({
      where: { id },
    });
    await prisma.ticketRequirement.deleteMany({
      where: { ticketId: id },
    });

    await prisma.history.create({
      data: {
        tableName: "Ticket",
        recordId: id.toString(),
        action: "DELETE",
        oldValues: JSON.stringify(existingTicket),
        userId,
      },
    });

    return {
      message: "Ticket deleted successfully",
      deletedTicket: existingTicket,
    };
  }
}

export const ticketService = new TicketService();
