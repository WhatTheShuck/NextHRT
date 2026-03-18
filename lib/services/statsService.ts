import prisma from "@/lib/prisma";

export class StatsService {
  async getStats() {
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      activeDepartments,
      totalLocations,
      activeLocations,
      totalTraining,
      activeTraining,
      totalTickets,
      activeTickets,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.department.count({ where: { isActive: true } }),
      prisma.location.count(),
      prisma.location.count({ where: { isActive: true } }),
      prisma.training.count(),
      prisma.training.count({ where: { isActive: true } }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { isActive: true } }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      activeDepartments,
      totalLocations,
      activeLocations,
      totalTraining,
      activeTraining,
      totalTickets,
      activeTickets,
    };
  }
}

export const statsService = new StatsService();
