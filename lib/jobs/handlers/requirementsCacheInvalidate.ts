import prisma from "@/lib/prisma";
import { isTicketRecordValid } from "@/lib/services/ticketCompliance";
import { isTrainingSatisfied, type TrainingLite } from "@/lib/services/trainingCompliance";

export async function requirementsCacheInvalidateHandler(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const employeeId = payload.employeeId as number;

  if (!employeeId) {
    throw new Error(
      "requirementsCacheInvalidate: missing employeeId in payload",
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      departmentId: true,
      locationId: true,
      isActive: true,
    },
  });

  // If employee no longer exists or is inactive, wipe their cache entries and exit
  if (!employee || !employee.isActive) {
    await prisma.requirementsCacheEntry.deleteMany({ where: { employeeId } });
    return { employeeId, cleared: true };
  }

  const whereClause = {
    OR: [
      {
        departmentId: employee.departmentId,
        locationId: employee.locationId,
      },
      { departmentId: -1, locationId: employee.locationId },
      { departmentId: employee.departmentId, locationId: -1 },
      { departmentId: -1, locationId: -1 },
    ],
  };

  const [
    trainingRequirements,
    ticketRequirements,
    trainingRecords,
    ticketRecords,
    exemptions,
  ] = await Promise.all([
    prisma.trainingRequirement.findMany({
      where: whereClause,
      include: { training: { select: { isActive: true } } },
    }),
    prisma.ticketRequirement.findMany({
      where: whereClause,
      include: { ticket: { select: { isActive: true } } },
    }),
    prisma.trainingRecords.findMany({
      where: { employeeId },
      select: { trainingId: true, revisionId: true },
    }),
    prisma.ticketRecords.findMany({
      where: { employeeId },
      select: { ticketId: true, expiryDate: true },
    }),
    prisma.trainingTicketExemption.findMany({
      where: { employeeId, status: "Active" },
      select: { type: true, trainingId: true, ticketId: true },
    }),
  ]);

  const now = new Date();

  // Group training records by trainingId for revision-aware compliance check
  const recordsByTraining = new Map<number, { revisionId: number | null }[]>();
  for (const r of trainingRecords) {
    const existing = recordsByTraining.get(r.trainingId) ?? [];
    existing.push({ revisionId: r.revisionId });
    recordsByTraining.set(r.trainingId, existing);
  }

  // Fetch revision data only for trainings that have records (others can never be satisfied)
  const trainingIdsWithRecords = [...recordsByTraining.keys()];
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
  const trainingMap = new Map<number, TrainingLite>(
    trainingsWithRevisions.map((t) => [t.id, t]),
  );

  const completedTrainingIds = new Set<number>();
  for (const [trainingId, recs] of recordsByTraining) {
    const t = trainingMap.get(trainingId) ?? {
      requiresRetrainingOnRevision: false,
      revisions: [],
    };
    if (isTrainingSatisfied(recs, t, now)) completedTrainingIds.add(trainingId);
  }

  const completedTicketIds = new Set(
    ticketRecords
      .filter((r) => isTicketRecordValid(r, now))
      .map((r) => r.ticketId),
  );
  const exemptTrainingIds = new Set(
    exemptions
      .filter((e) => e.type === "Training" && e.trainingId != null)
      .map((e) => e.trainingId!),
  );
  const exemptTicketIds = new Set(
    exemptions
      .filter((e) => e.type === "Ticket" && e.ticketId != null)
      .map((e) => e.ticketId!),
  );

  const entries: {
    employeeId: number;
    itemType: "Training" | "Ticket";
    itemId: number;
  }[] = [];

  for (const req of trainingRequirements) {
    if (!req.training.isActive) continue;
    if (
      !completedTrainingIds.has(req.trainingId) &&
      !exemptTrainingIds.has(req.trainingId)
    ) {
      entries.push({ employeeId, itemType: "Training", itemId: req.trainingId });
    }
  }

  for (const req of ticketRequirements) {
    if (!req.ticket.isActive) continue;
    if (
      !completedTicketIds.has(req.ticketId) &&
      !exemptTicketIds.has(req.ticketId)
    ) {
      entries.push({ employeeId, itemType: "Ticket", itemId: req.ticketId });
    }
  }

  await prisma.$transaction([
    prisma.requirementsCacheEntry.deleteMany({ where: { employeeId } }),
    prisma.requirementsCacheEntry.createMany({ data: entries }),
  ]);

  return { employeeId, entries: entries.length };
}
