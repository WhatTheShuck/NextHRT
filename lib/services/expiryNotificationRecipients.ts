import prisma from "@/lib/prisma";

export interface ExpiryRecipients {
  to: string[];
  cc: string[];
}

/**
 * Recipients for a ticket-expiry notification about `employeeId` (spec §5.6):
 *   To = managers of the employee's department,
 *   Cc = admins who have not opted out (receivesExpiryNotifications),
 *   never the employee.
 * If there are no managers, admins are promoted to To so the mail still goes somewhere.
 */
export async function resolveExpiryRecipients(
  employeeId: number,
): Promise<ExpiryRecipients> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  });
  if (!employee) return { to: [], cc: [] };

  const managers = await prisma.user.findMany({
    where: {
      managedDepartments: { some: { id: employee.departmentId } },
      email: { not: null },
    },
    select: { email: true },
  });
  const admins = await prisma.user.findMany({
    where: {
      role: "Admin",
      receivesExpiryNotifications: true,
      email: { not: null },
    },
    select: { email: true },
  });

  const managerEmails = [...new Set(managers.map((m) => m.email!).filter(Boolean))];
  const adminEmails = [...new Set(admins.map((a) => a.email!).filter(Boolean))];

  if (managerEmails.length === 0) {
    return { to: adminEmails, cc: [] };
  }
  return {
    to: managerEmails,
    cc: adminEmails.filter((e) => !managerEmails.includes(e)),
  };
}
