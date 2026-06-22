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
      totalJobFamilies,
      activeJobFamilies,
      totalMedicalStandards,
      activeMedicalStandards,
      totalPrograms,
      activePrograms,
      totalHardwareItems,
      activeHardwareItems,
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
      prisma.jobFamily.count(),
      prisma.jobFamily.count({ where: { isActive: true } }),
      prisma.medicalStandard.count(),
      prisma.medicalStandard.count({ where: { isActive: true } }),
      prisma.program.count(),
      prisma.program.count({ where: { isActive: true } }),
      prisma.hardwareItem.count(),
      prisma.hardwareItem.count({ where: { isActive: true } }),
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
      totalJobFamilies,
      activeJobFamilies,
      totalMedicalStandards,
      activeMedicalStandards,
      totalPrograms,
      activePrograms,
      totalHardwareItems,
      activeHardwareItems,
    };
  }
}

export const statsService = new StatsService();
