import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { currentRevision } from "@/lib/services/trainingCompliance";

const WINDOW_MS = 25 * 60 * 60 * 1000; // 25 hours — catches any revision that crossed midnight in the last daily run

export async function trainingRevisionCrossingHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  // Find revisions that became effective within the last 25 hours
  const recentRevisions = await prisma.trainingRevision.findMany({
    where: { effectiveDate: { gte: windowStart, lte: now } },
    include: {
      training: {
        select: {
          id: true,
          requiresRetrainingOnRevision: true,
          revisions: {
            select: { id: true, effectiveDate: true, createdAt: true, overrideRequiresRetraining: true },
          },
        },
      },
    },
  });

  const affectedTrainingIds: number[] = [];
  for (const rev of recentRevisions) {
    const cur = currentRevision(rev.training.revisions, now);
    if (cur?.id !== rev.id) continue; // Superseded by a newer revision
    const requiresRetraining = rev.overrideRequiresRetraining ?? rev.training.requiresRetrainingOnRevision;
    if (!requiresRetraining) continue;
    affectedTrainingIds.push(rev.training.id);
  }

  if (affectedTrainingIds.length === 0) {
    return { revisionsChecked: recentRevisions.length, affectedEmployees: 0 };
  }

  // Find employees whose cache may have become stale for these trainings
  const cacheEntries = await prisma.requirementsCacheEntry.findMany({
    where: { itemType: "Training", itemId: { in: affectedTrainingIds } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });

  for (const entry of cacheEntries) {
    await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: entry.employeeId });
  }

  return { revisionsChecked: recentRevisions.length, affectedEmployees: cacheEntries.length };
}
