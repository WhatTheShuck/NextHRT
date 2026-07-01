import cron from "node-cron";
import { enqueue } from "@/lib/jobs/jobQueue";

export function startScheduler(): void {
  // Daily at midnight
  cron.schedule("0 0 * * *", async () => {
    await enqueue("EXEMPTION_EXPIRY");
    await enqueue("TICKET_EXPIRY");
    await enqueue("INACTIVE_EMPLOYEE_CHECK");
    await enqueue("TRAINING_REVISION_CROSSING");
    console.log("[Scheduler] Enqueued daily maintenance jobs");
  });

  // Nightly at 1am — full requirements cache rebuild for freshness
  cron.schedule("0 1 * * *", async () => {
    await enqueue("REQUIREMENTS_CACHE_REBUILD");
    console.log("[Scheduler] Enqueued nightly cache rebuild");
  });

  // Weekly Sunday at 2am
  cron.schedule("0 2 * * 0", async () => {
    await enqueue("ORPHANED_IMAGE_CLEANUP");
    console.log("[Scheduler] Enqueued weekly cleanup job");
  });

  console.log("[Scheduler] Started");
}
