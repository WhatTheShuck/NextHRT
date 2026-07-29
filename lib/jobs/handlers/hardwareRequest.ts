import prisma from "@/lib/prisma";
import {
  assetCheckoutService,
  buildEmployeeEmail,
} from "@/lib/services/assetCheckoutService";
import { logService } from "@/lib/services/logService";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

interface HardwareRequestPayload {
  hardwareItemId: number;
  employeeId: number;
  managerEmployeeId: number | null;
  nonStandard?: boolean;
  justification?: string | null;
  callText?: boolean;
  needsData?: boolean;
  numberOption?: "NEW" | "REUSE" | "NONE" | null;
  reuseNumberFromEmployeeId?: number | null;
}

// The hardware item's payloadTemplate carries the Snipe-IT category this item
// maps to. categoryId 0 (the seed default) means "not configured yet" — the
// job fails with instructions rather than raising a garbage request.
interface HardwareItemTemplate {
  categoryId?: number;
  categoryName?: string;
}

/**
 * §7.5 — Raise a hardware request in AssetCheckout for one onboarding
 * hardware selection.
 *
 * AssetCheckout speaks Snipe-IT user IDs, not HRT employee IDs, so the
 * handler first ensures both the new hire and their manager exist as Snipe
 * users (find-or-create by email — idempotent, so job retries are safe),
 * then posts the request into AssetCheckout's normal approval workflow.
 */
export async function hardwareRequestHandler(
  rawPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = rawPayload as unknown as HardwareRequestPayload;
  const {
    hardwareItemId,
    employeeId,
    managerEmployeeId,
    nonStandard,
    justification,
    callText,
    needsData,
    numberOption,
    reuseNumberFromEmployeeId,
  } = payload;

  const [item, employee, manager, reuseFrom] = await Promise.all([
    prisma.hardwareItem.findUnique({ where: { id: hardwareItemId } }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
    managerEmployeeId
      ? prisma.employee.findUnique({ where: { id: managerEmployeeId } })
      : Promise.resolve(null),
    numberOption === "REUSE" && reuseNumberFromEmployeeId
      ? prisma.employee.findUnique({ where: { id: reuseNumberFromEmployeeId } })
      : Promise.resolve(null),
  ]);

  if (!item) {
    throw new Error(`Hardware item ${hardwareItemId} not found`);
  }
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }
  if (!manager) {
    throw new Error(
      `Hardware request for employee ${employeeId} has no manager — AssetCheckout requires a manager for its approval workflow`,
    );
  }

  let template: HardwareItemTemplate = {};
  if (item.payloadTemplate) {
    try {
      template = JSON.parse(item.payloadTemplate) as HardwareItemTemplate;
    } catch {
      throw new Error(
        `Hardware item "${item.name}" has a malformed payloadTemplate — fix it in the hardware catalogue`,
      );
    }
  }

  const categoryId = template.categoryId;
  const categoryName = template.categoryName ?? item.name;
  if (typeof categoryId !== "number" || categoryId <= 0) {
    throw new Error(
      `Hardware item "${item.name}" has no Snipe-IT categoryId configured — set {"categoryId":<id>,"categoryName":"<name>"} in its payloadTemplate`,
    );
  }

  // Ensure both parties exist in Snipe. The new hire usually won't yet;
  // the manager almost always will.
  const employeeFirst = employee.preferredFirstName ?? employee.legalFirstName;
  const employeeLast = employee.preferredLastName ?? employee.legalLastName;
  const managerFirst = manager.preferredFirstName ?? manager.legalFirstName;
  const managerLast = manager.preferredLastName ?? manager.legalLastName;

  const [snipeUser, snipeManager] = await Promise.all([
    assetCheckoutService.ensureUser({
      firstName: employeeFirst,
      lastName: employeeLast,
      email: buildEmployeeEmail(employeeFirst, employeeLast),
      jobTitle: employee.title,
    }),
    assetCheckoutService.ensureUser({
      firstName: managerFirst,
      lastName: managerLast,
      email: buildEmployeeEmail(managerFirst, managerLast),
      jobTitle: manager.title,
    }),
  ]);

  const result = await assetCheckoutService.createDeviceRequest({
    userId: snipeUser.id,
    userName: snipeUser.name,
    categoryId,
    categoryName,
    requestType: nonStandard ? "NON_STANDARD" : "STANDARD",
    reason:
      justification ??
      `Onboarding hardware request (${item.name}) for ${snipeUser.name}`,
    manager: snipeManager.name,
    managerId: snipeManager.id,
    callText: callText ?? false,
    needsData: needsData ?? false,
    numberOption: numberOption ?? undefined,
    reuseNumberFromEmail: reuseFrom
      ? buildEmployeeEmail(
          reuseFrom.preferredFirstName ?? reuseFrom.legalFirstName,
          reuseFrom.preferredLastName ?? reuseFrom.legalLastName,
        )
      : null,
    // The reusable number for a SIM is the mobile, not the landline.
    reuseNumberPhone: reuseFrom?.mobile ?? null,
  });

  await logService.log(
    `[hardware-request] raised "${item.name}" request in AssetCheckout for ${snipeUser.name} (employee ${employeeId}, Snipe user ${snipeUser.id})`,
    AppLogSeverity.Info,
    "hardwareRequest",
  );

  return {
    item: item.name,
    employeeId,
    snipeUserId: snipeUser.id,
    snipeManagerId: snipeManager.id,
    requestType: nonStandard ? "NON_STANDARD" : "STANDARD",
    assetCheckoutResult: result,
  };
}
