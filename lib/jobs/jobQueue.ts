import prisma from "@/lib/prisma";
import { JobType } from "@/generated/prisma_client/client";

export async function enqueue(
  type: JobType,
  payload?: Record<string, unknown>,
  scheduledAt?: Date,
): Promise<void> {
  const payloadStr = payload ? JSON.stringify(payload) : null;

  // Deduplication: skip if an identical Pending job already exists
  const existing = await prisma.backgroundJob.findFirst({
    where: {
      type,
      status: "Pending",
      payload: payloadStr,
    },
  });

  if (existing) return;

  await prisma.backgroundJob.create({
    data: {
      type,
      payload: payloadStr,
      scheduledAt: scheduledAt ?? new Date(),
    },
  });
}
