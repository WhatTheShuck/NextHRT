import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";

export async function exemptionExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const expiredExemptions = await prisma.trainingTicketExemption.findMany({
    where: {
      status: "Active",
      endDate: { lte: now },
    },
    select: { id: true, employeeId: true },
  });

  if (expiredExemptions.length === 0) {
    return { expired: 0 };
  }

  const ids = expiredExemptions.map((e) => e.id);

  await prisma.trainingTicketExemption.updateMany({
    where: { id: { in: ids } },
    data: { status: "Expired" },
  });

  // Invalidate cache for each affected employee
  const uniqueEmployeeIds = [
    ...new Set(expiredExemptions.map((e) => e.employeeId)),
  ];
  for (const employeeId of uniqueEmployeeIds) {
    await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId });
  }

  return {
    expired: expiredExemptions.length,
    employeesAffected: uniqueEmployeeIds.length,
  };
}
