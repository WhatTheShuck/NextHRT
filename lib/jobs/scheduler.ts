import cron from "node-cron";
import { enqueue } from "@/lib/jobs/jobQueue";

export function startScheduler(): void {
  // Daily at midnight
  cron.schedule("0 0 * * *", async () => {
    await enqueue("EXEMPTION_EXPIRY");
    await enqueue("TICKET_EXPIRY");
    await enqueue("INACTIVE_EMPLOYEE_CHECK");
    console.log("[Scheduler] Enqueued daily maintenance jobs");
  });

  // Weekly Sunday at 2am
  cron.schedule("0 2 * * 0", async () => {
    await enqueue("ORPHANED_IMAGE_CLEANUP");
    console.log("[Scheduler] Enqueued weekly cleanup job");
  });

  console.log("[Scheduler] Started");
}
