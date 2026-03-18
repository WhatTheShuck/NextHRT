import prisma from "@/lib/prisma";

export async function requirementsCacheRebuildHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [
    allEmployees,
    trainingRequirements,
    ticketRequirements,
    trainingRecords,
    ticketRecords,
    exemptions,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, departmentId: true, locationId: true },
    }),
    prisma.trainingRequirement.findMany({
      include: { training: { select: { isActive: true } } },
    }),
    prisma.ticketRequirement.findMany({
      include: { ticket: { select: { isActive: true } } },
    }),
    prisma.trainingRecords.findMany({
      select: { employeeId: true, trainingId: true },
    }),
    prisma.ticketRecords.findMany({
      select: { employeeId: true, ticketId: true },
    }),
    prisma.trainingTicketExemption.findMany({
      where: { status: "Active" },
      select: { employeeId: true, type: true, trainingId: true, ticketId: true },
    }),
  ]);

  const completedTraining = new Set(
    trainingRecords.map((r) => `${r.employeeId}:${r.trainingId}`),
  );
  const completedTickets = new Set(
    ticketRecords.map((r) => `${r.employeeId}:${r.ticketId}`),
  );
  const exemptTraining = new Set(
    exemptions
      .filter((e) => e.type === "Training" && e.trainingId)
      .map((e) => `${e.employeeId}:${e.trainingId}`),
  );
  const exemptTickets = new Set(
    exemptions
      .filter((e) => e.type === "Ticket" && e.ticketId)
      .map((e) => `${e.employeeId}:${e.ticketId}`),
  );

  const entries: {
    employeeId: number;
    itemType: "Training" | "Ticket";
    itemId: number;
  }[] = [];

  for (const employee of allEmployees) {
    for (const req of trainingRequirements) {
      if (!req.training.isActive) continue;
      const deptMatch =
        req.departmentId === -1 || req.departmentId === employee.departmentId;
      const locMatch =
        req.locationId === -1 || req.locationId === employee.locationId;
      if (!deptMatch || !locMatch) continue;
      const key = `${employee.id}:${req.trainingId}`;
      if (!completedTraining.has(key) && !exemptTraining.has(key)) {
        entries.push({
          employeeId: employee.id,
          itemType: "Training",
          itemId: req.trainingId,
        });
      }
    }

    for (const req of ticketRequirements) {
      if (!req.ticket.isActive) continue;
      const deptMatch =
        req.departmentId === -1 || req.departmentId === employee.departmentId;
      const locMatch =
        req.locationId === -1 || req.locationId === employee.locationId;
      if (!deptMatch || !locMatch) continue;
      const key = `${employee.id}:${req.ticketId}`;
      if (!completedTickets.has(key) && !exemptTickets.has(key)) {
        entries.push({
          employeeId: employee.id,
          itemType: "Ticket",
          itemId: req.ticketId,
        });
      }
    }
  }

  await prisma.$transaction([
    prisma.requirementsCacheEntry.deleteMany({}),
    prisma.requirementsCacheEntry.createMany({ data: entries }),
  ]);

  return {
    totalEntries: entries.length,
    employeesProcessed: allEmployees.length,
  };
}
