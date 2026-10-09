import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma_client/client";

export type MissingReason = "NotProvided" | "RetrainingRequired";

export interface MissingItem {
  employeeId: number;
  kind: "Ticket" | "Training";
  itemId: number;
  itemName: string;
  reason: MissingReason;
}

/**
 * The "Missing" definition (spec decision 12), read from the requirements cache (which already
 * drops inactive items and exemptions):
 *   - a required ticket with no record of any date (one with only expired records is "Expired"),
 *   - a required External training with no record ("NotProvided") or whose records a revision
 *     invalidated ("RetrainingRequired").
 * Internal/SOP training is never missing here: there is nothing for the employee to upload.
 * Prisma-only on purpose so the job and the go-live script can use it without auth.
 */
export async function findMissingItems(employeeWhere: Prisma.EmployeeWhereInput): Promise<MissingItem[]> {
  const entries = await prisma.requirementsCacheEntry.findMany({
    where: { employee: employeeWhere },
    select: { employeeId: true, itemType: true, itemId: true },
    orderBy: [{ employeeId: "asc" }, { itemType: "asc" }, { itemId: "asc" }],
  });
  if (entries.length === 0) return [];

  const employeeIds = [...new Set(entries.map((e) => e.employeeId))];
  const ticketIds = [...new Set(entries.filter((e) => e.itemType === "Ticket").map((e) => e.itemId))];
  const trainingIds = [...new Set(entries.filter((e) => e.itemType === "Training").map((e) => e.itemId))];

  const [ticketRecs, trainingRecs, tickets, trainings] = await Promise.all([
    prisma.ticketRecords.findMany({
      where: { employeeId: { in: employeeIds }, ticketId: { in: ticketIds } },
      select: { employeeId: true, ticketId: true },
    }),
    prisma.trainingRecords.findMany({
      where: { employeeId: { in: employeeIds }, trainingId: { in: trainingIds } },
      select: { employeeId: true, trainingId: true },
    }),
    prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, ticketName: true } }),
    prisma.training.findMany({
      where: { id: { in: trainingIds } },
      select: { id: true, title: true, category: true },
    }),
  ]);

  const hasTicketRecord = new Set(ticketRecs.map((r) => `${r.employeeId}:${r.ticketId}`));
  const hasTrainingRecord = new Set(trainingRecs.map((r) => `${r.employeeId}:${r.trainingId}`));
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const trainingById = new Map(trainings.map((t) => [t.id, t]));

  const out: MissingItem[] = [];
  for (const e of entries) {
    const key = `${e.employeeId}:${e.itemId}`;
    if (e.itemType === "Ticket") {
      const t = ticketById.get(e.itemId);
      if (!t || hasTicketRecord.has(key)) continue;
      out.push({ employeeId: e.employeeId, kind: "Ticket", itemId: e.itemId, itemName: t.ticketName, reason: "NotProvided" });
    } else {
      const t = trainingById.get(e.itemId);
      if (!t || t.category !== "External") continue;
      out.push({
        employeeId: e.employeeId,
        kind: "Training",
        itemId: e.itemId,
        itemName: t.title,
        reason: hasTrainingRecord.has(key) ? "RetrainingRequired" : "NotProvided",
      });
    }
  }
  return out;
}
