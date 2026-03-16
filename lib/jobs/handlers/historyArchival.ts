import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

const BATCH_SIZE = 500;

export async function historyArchivalHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const settings = await appSettingService.getSettings();
  const retentionYears = parseInt(
    settings["jobs.historyRetentionYears"] ?? "7",
    10,
  );

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  let totalDeleted = 0;

  // Delete in batches to avoid locking SQLite for too long
  while (true) {
    const batch = await prisma.history.findMany({
      where: { timestamp: { lt: cutoffDate } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((r) => r.id);
    const result = await prisma.history.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += result.count;
  }

  return {
    deleted: totalDeleted,
    cutoffDate: cutoffDate.toISOString(),
    retentionYears,
  };
}
