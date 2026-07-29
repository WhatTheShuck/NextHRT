import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";

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
    return { deactivated: 0 };
  }

  const result = await prisma.employee.updateMany({
    where: { id: { in: exiting.map((e) => e.id) } },
    data: { isActive: false },
  });

  for (const employee of exiting) {
    await enqueue("ASSET_CHECKIN", { employeeId: employee.id });
  }

  return { deactivated: result.count, assetCheckinsEnqueued: exiting.length };
}
