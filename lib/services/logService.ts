import prisma from "@/lib/prisma";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

class LogService {
  async log(message: string, severity?: AppLogSeverity, source?: string): Promise<void> {
    await prisma.appLog.create({
      data: { message, severity: severity ?? AppLogSeverity.Info, source },
    });
  }

  async getLogs(options?: { severity?: AppLogSeverity; limit?: number }) {
    return prisma.appLog.findMany({
      where: options?.severity ? { severity: options.severity } : undefined,
      orderBy: { createdAt: "desc" },
      take: options?.limit,
    });
  }

  async clearLogs(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const result = await prisma.appLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}

export const logService = new LogService();
