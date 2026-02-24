import prisma from "@/lib/prisma";

export class StatsService {
  async getStats() {
    const [
      totalEmployees,
      totalDepartments,
      totalLocations,
      totalTraining,
      totalTickets,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.department.count(),
      prisma.location.count(),
      prisma.training.count(),
      prisma.ticket.count(),
    ]);

    return {
      totalEmployees,
      totalDepartments,
      totalLocations,
      totalTraining,
      totalTickets,
    };
  }
}

export const statsService = new StatsService();
