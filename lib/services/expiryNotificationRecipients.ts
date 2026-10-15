import prisma from "@/lib/prisma";
import { getAuthorityMode, getExpiryRecipientEmployeeIds } from "./authorityService";

export interface ExpiryRecipients {
  to: string[];
}

/**
 * Manager recipients for a ticket-expiry notification about `employeeId`: the employee's
 * department managers, or under line-manager authority their direct manager plus anyone acting
 * at that manager's level (workday spec §9.3). Admins are never emailed; they use the Expiring &
 * Missing page (docs/superpowers/specs/2026-10-09-document-upload-design.md decision 11). The
 * employee is emailed separately, by the employee track of TICKET_EXPIRY.
 */
export async function resolveExpiryRecipients(employeeId: number): Promise<ExpiryRecipients> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { departmentId: true },
  });
  if (!employee) return { to: [] };

  const lineMode = (await getAuthorityMode()) === "lineManager";
  const managers = await prisma.user.findMany({
    where: {
      ...(lineMode
        ? { employeeId: { in: await getExpiryRecipientEmployeeIds(employeeId) } }
        : { managedDepartments: { some: { id: employee.departmentId } } }),
      email: { not: null },
    },
    select: { email: true },
  });
  return { to: [...new Set(managers.map((m) => m.email!).filter(Boolean))] };
}
