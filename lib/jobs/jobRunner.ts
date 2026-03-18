import prisma from "@/lib/prisma";
import { JobType } from "@/generated/prisma_client/client";
import { appSettingService } from "@/lib/services/appSettingService";

type HandlerFn = (
  payload: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const handlers = new Map<JobType, HandlerFn>();

export function registerHandler(type: JobType, handler: HandlerFn): void {
  handlers.set(type, handler);
}

async function tick(): Promise<void> {
  const job = await prisma.backgroundJob.findFirst({
    where: {
      status: "Pending",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (!job) return;

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: { status: "Running", startedAt: new Date() },
  });

  const handler = handlers.get(job.type);

  if (!handler) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Failed",
        errorMessage: `No handler registered for job type: ${job.type}`,
        completedAt: new Date(),
      },
    });
    return;
  }

  try {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const result = await handler(payload);
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Completed",
        resultSummary: JSON.stringify(result),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function startRunner(): Promise<void> {
  if (intervalHandle) return; // already running

  const settings = await appSettingService.getSettings();
  const intervalMs = parseInt(settings["jobs.pollIntervalMs"] ?? "5000", 10);

  intervalHandle = setInterval(() => {
    tick().catch((err) =>
      console.error("[JobRunner] Unhandled tick error:", err),
    );
  }, intervalMs);

  console.log(`[JobRunner] Started — polling every ${intervalMs}ms`);
}

export function stopRunner(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
