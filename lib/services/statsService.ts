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
      totalSops,
      activeSops,
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
      // SOPs are counted separately: two Training rows per SOP would otherwise
      // inflate the training tally.
      prisma.training.count({ where: { category: { not: "SOP" } } }),
      prisma.training.count({
        where: { isActive: true, category: { not: "SOP" } },
      }),
      // One count per pair — a Practical half is the only SOP row with a partner
      // pointing at it, so excluding those leaves exactly the directory's rows.
      prisma.training.count({
        where: { category: "SOP", sopPartnerOf: { is: null } },
      }),
      prisma.training.count({
        where: { category: "SOP", sopPartnerOf: { is: null }, isActive: true },
      }),
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
      totalSops,
      activeSops,
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
