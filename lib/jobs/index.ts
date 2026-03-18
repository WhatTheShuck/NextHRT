import { registerHandler, startRunner } from "@/lib/jobs/jobRunner";
import { startScheduler } from "@/lib/jobs/scheduler";
import { enqueue } from "@/lib/jobs/jobQueue";
import { exemptionExpiryHandler } from "@/lib/jobs/handlers/exemptionExpiry";
import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";
import { requirementsCacheRebuildHandler } from "@/lib/jobs/handlers/requirementsCacheRebuild";
import { requirementsCacheInvalidateHandler } from "@/lib/jobs/handlers/requirementsCacheInvalidate";
import { inactiveEmployeeCheckHandler } from "@/lib/jobs/handlers/inactiveEmployeeCheck";
import { orphanedImageCleanupHandler } from "@/lib/jobs/handlers/orphanedImageCleanup";
import { historyArchivalHandler } from "@/lib/jobs/handlers/historyArchival";

export async function start(): Promise<void> {
  registerHandler("EXEMPTION_EXPIRY", exemptionExpiryHandler);
  registerHandler("TICKET_EXPIRY", ticketExpiryHandler);
  registerHandler("REQUIREMENTS_CACHE_REBUILD", requirementsCacheRebuildHandler);
  registerHandler("REQUIREMENTS_CACHE_INVALIDATE", requirementsCacheInvalidateHandler);
  registerHandler("INACTIVE_EMPLOYEE_CHECK", inactiveEmployeeCheckHandler);
  registerHandler("ORPHANED_IMAGE_CLEANUP", orphanedImageCleanupHandler);
  registerHandler("HISTORY_ARCHIVAL", historyArchivalHandler);

  // Warm the requirements cache on boot
  await enqueue("REQUIREMENTS_CACHE_REBUILD");

  await startRunner();
  startScheduler();

  console.log("[Jobs] Background job system started");
}
