import prisma from "@/lib/prisma";

export async function ticketExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const [expiredCount, expiringSoonCount] = await Promise.all([
    prisma.ticketRecords.count({
      where: {
        expiryDate: { lte: now },
      },
    }),
    prisma.ticketRecords.count({
      where: {
        expiryDate: {
          gt: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return { expired: expiredCount, expiringSoon: expiringSoonCount };
}
