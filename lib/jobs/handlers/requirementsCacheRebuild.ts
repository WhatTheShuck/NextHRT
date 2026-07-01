import prisma from "@/lib/prisma";
import { isTicketRecordValid } from "@/lib/services/ticketCompliance";
import { isTrainingSatisfied, type TrainingLite } from "@/lib/services/trainingCompliance";

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
      select: { employeeId: true, trainingId: true, revisionId: true },
    }),
    prisma.ticketRecords.findMany({
      select: { employeeId: true, ticketId: true, expiryDate: true },
    }),
    prisma.trainingTicketExemption.findMany({
      where: { status: "Active" },
      select: { employeeId: true, type: true, trainingId: true, ticketId: true },
    }),
  ]);

  // Fetch revision data for all training IDs that have records (others can never be satisfied)
  const trainingIdsWithRecords = [...new Set(trainingRecords.map((r) => r.trainingId))];
  const trainingsWithRevisions =
    trainingIdsWithRecords.length > 0
      ? await prisma.training.findMany({
          where: { id: { in: trainingIdsWithRecords } },
          select: {
            id: true,
            requiresRetrainingOnRevision: true,
            revisions: {
              select: {
                id: true,
                effectiveDate: true,
                createdAt: true,
                overrideRequiresRetraining: true,
              },
            },
          },
        })
      : [];
  const ruleMap = new Map<number, TrainingLite>(
    trainingsWithRevisions.map((t) => [t.id, t]),
  );

  // Group training records by "employeeId:trainingId" pair
  const recsByPair = new Map<string, { revisionId: number | null }[]>();
  for (const r of trainingRecords) {
    const key = `${r.employeeId}:${r.trainingId}`;
    const existing = recsByPair.get(key) ?? [];
    existing.push({ revisionId: r.revisionId });
    recsByPair.set(key, existing);
  }

  const now = new Date();
  const completedTickets = new Set(
    ticketRecords
      .filter((r) => isTicketRecordValid(r, now))
      .map((r) => `${r.employeeId}:${r.ticketId}`),
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

      const pairKey = `${employee.id}:${req.trainingId}`;
      if (exemptTraining.has(pairKey)) continue;

      const recs = recsByPair.get(pairKey) ?? [];
      const t = ruleMap.get(req.trainingId) ?? {
        requiresRetrainingOnRevision: false,
        revisions: [],
      };
      if (!isTrainingSatisfied(recs, t, now)) {
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
