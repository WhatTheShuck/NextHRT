import prisma from "@/lib/prisma";
import {
  assetCheckoutService,
  buildEmployeeEmail,
} from "@/lib/services/assetCheckoutService";
import { logService } from "@/lib/services/logService";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

/**
 * SNIPE_PHONE_SYNC — mirror Snipe-IT user phone numbers onto HRT employees.
 *
 * Snipe is the system of record for phone numbers; HRT keeps a local copy of
 * both the landline (Employee.phone) and mobile (Employee.mobile) so the
 * onboarding form can offer "reuse an existing number" (the mobile) without a
 * live lookup. Users may have one, both, or neither. Matched by the same
 * preferred-name email HRT uses to create/resolve the Snipe user.
 */
export async function snipePhoneSyncHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const phones = await assetCheckoutService.listUserPhones();

  // email (lowercased) → { phone, mobile }
  const byEmail = new Map<string, { phone: string | null; mobile: string | null }>();
  for (const u of phones) {
    if (u.email)
      byEmail.set(u.email.trim().toLowerCase(), {
        phone: u.phone,
        mobile: u.mobile,
      });
  }

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      legalFirstName: true,
      legalLastName: true,
      preferredFirstName: true,
      preferredLastName: true,
      phone: true,
      mobile: true,
    },
  });

  let updated = 0;
  for (const emp of employees) {
    const first = emp.preferredFirstName ?? emp.legalFirstName;
    const last = emp.preferredLastName ?? emp.legalLastName;
    const email = buildEmployeeEmail(first, last).toLowerCase();

    const snipe = byEmail.get(email);
    if (!snipe) continue; // no Snipe user for this employee
    const phone = snipe.phone ?? null;
    const mobile = snipe.mobile ?? null;

    if (phone !== emp.phone || mobile !== emp.mobile) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { phone, mobile },
      });
      updated++;
    }
  }

  await logService.log(
    `[snipe-phone-sync] synced ${updated} phone number(s) from ${phones.length} Snipe user(s)`,
    AppLogSeverity.Info,
    "snipePhoneSync",
  );

  return { snipeUsers: phones.length, employeesUpdated: updated };
}
