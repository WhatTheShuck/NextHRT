import prisma from "@/lib/prisma";

export async function inactiveEmployeeCheckHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const result = await prisma.employee.updateMany({
    where: {
      isActive: true,
      finishDate: { lte: now },
    },
    data: { isActive: false },
  });

  return { deactivated: result.count };
}
