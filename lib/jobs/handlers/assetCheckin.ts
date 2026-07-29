import prisma from "@/lib/prisma";
import {
  assetCheckoutService,
  buildEmployeeEmail,
} from "@/lib/services/assetCheckoutService";
import { logService } from "@/lib/services/logService";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

interface AssetCheckinPayload {
  employeeId: number;
}

/**
 * Offboarding: when an employee exits, check their Snipe-IT assets back in
 * and deactivate their Snipe account, via the AssetCheckout integration API.
 *
 * Enqueued when an employee is deactivated — either explicitly (employee
 * edit) or by the scheduled INACTIVE_EMPLOYEE_CHECK sweep when their finish
 * date passes.
 *
 * An employee with no Snipe account is a normal outcome (not everyone gets
 * hardware), so that path returns a skipped result instead of failing.
 * Per-asset checkin failures reported by AssetCheckout fail the job so they
 * stay visible for manual follow-up.
 */
export async function assetCheckinHandler(
  rawPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { employeeId } = rawPayload as unknown as AssetCheckinPayload;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const firstName = employee.preferredFirstName ?? employee.legalFirstName;
  const lastName = employee.preferredLastName ?? employee.legalLastName;
  const email = buildEmployeeEmail(firstName, lastName);

  const snipeUser = await assetCheckoutService.lookupUserByEmail(email);
  if (!snipeUser) {
    return {
      skipped: true,
      reason: `No Snipe user found for ${email} — nothing to check in`,
      employeeId,
    };
  }

  const result = await assetCheckoutService.offboardUser(
    snipeUser.id,
    `Checked in via NextHRT offboarding (employee ${employeeId} exited)`,
  );

  const summary = {
    employeeId,
    snipeUserId: snipeUser.id,
    checkedIn: result.checkedIn.map((a) => a.asset_tag),
    failed: result.failed,
    userDeactivated: result.userDeactivated,
  };

  if (result.failed.length > 0) {
    await logService.log(
      `[asset-checkin] offboarding for employee ${employeeId} (Snipe user ${snipeUser.id}) had failures: ${JSON.stringify(result.failed)}`,
      AppLogSeverity.Warning,
      "assetCheckin",
    );
    throw new Error(
      `Offboarding partially failed for Snipe user ${snipeUser.id}: ${result.failed.length} item(s) need manual follow-up in Snipe-IT`,
    );
  }

  await logService.log(
    `[asset-checkin] offboarded Snipe user ${snipeUser.id} for employee ${employeeId}: ${result.checkedIn.length} asset(s) checked in, account deactivated`,
    AppLogSeverity.Info,
    "assetCheckin",
  );

  return summary;
}
