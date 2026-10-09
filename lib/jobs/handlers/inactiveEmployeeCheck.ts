import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { documentSubmissionService } from "@/lib/services/documentSubmissionService";

export async function inactiveEmployeeCheckHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  // Fetch-then-update (rather than a bare updateMany) so we know exactly who
  // was deactivated and can fan out an ASSET_CHECKIN per exiting employee.
  const exiting = await prisma.employee.findMany({
    where: {
      isActive: true,
      finishDate: { lte: now },
    },
    select: { id: true },
  });

  if (exiting.length === 0) {
    return { deactivated: 0, staleSubmissionsCancelled: await sweepStaleSubmissions() };
  }

  const result = await prisma.employee.updateMany({
    where: { id: { in: exiting.map((e) => e.id) } },
    data: { isActive: false },
  });
  // Best-effort: the deactivation has committed, and asset check-ins must still go out.
  try {
    await documentSubmissionService.cancelOpenForEmployees(exiting.map((e) => e.id));
  } catch (err) {
    console.error("[inactiveEmployeeCheck] cancelling open document submissions failed:", err);
  }

  for (const employee of exiting) {
    await enqueue("ASSET_CHECKIN", { employeeId: employee.id });
  }

  return {
    deactivated: result.count,
    assetCheckinsEnqueued: exiting.length,
    staleSubmissionsCancelled: await sweepStaleSubmissions(),
  };
}

/**
 * Cancels open submissions still sitting on inactive employees, so a best-effort cancel that
 * failed (here or on manual deactivation) is caught the next night. Best-effort itself: returns
 * the count, or null when it failed.
 */
async function sweepStaleSubmissions(): Promise<number | null> {
  try {
    const { count } = await prisma.documentSubmission.updateMany({
      where: { employee: { isActive: false }, status: { in: ["Pending", "ChangesRequested"] } },
      data: { status: "Cancelled" },
    });
    return count;
  } catch (err) {
    console.error("[inactiveEmployeeCheck] sweeping stale document submissions failed:", err);
    return null;
  }
}
