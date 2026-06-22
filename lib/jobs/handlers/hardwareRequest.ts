import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";
import { logService } from "@/lib/services/logService";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

interface HardwareRequestPayload {
  hardwareItemId: number;
  employeeId: number;
  managerEmployeeId: number | null;
  nonStandard?: boolean;
  justification?: string | null;
}

// Hardware API contract is pending (§9.1.2). This handler logs the intended
// request and returns a stub result. Uncomment the fetch() block below once
// the hardware platform auth + per-item payload shape are confirmed.
export async function hardwareRequestHandler(
  rawPayload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = rawPayload as unknown as HardwareRequestPayload;
  const { hardwareItemId, employeeId, managerEmployeeId, nonStandard, justification } = payload;

  const [item, settings] = await Promise.all([
    prisma.hardwareItem.findUnique({ where: { id: hardwareItemId } }),
    appSettingService.getSettings(),
  ]);

  if (!item) {
    throw new Error(`Hardware item ${hardwareItemId} not found`);
  }

  const endpoint = settings["onboarding.hardwareEndpoint"] || "https://checkout.ksb.com.au/";

  let requestBody: Record<string, unknown> = {};
  if (item.payloadTemplate) {
    try {
      requestBody = JSON.parse(item.payloadTemplate) as Record<string, unknown>;
    } catch {
      // Malformed template — proceed with minimal payload
    }
  }

  requestBody = {
    ...requestBody,
    employeeId,
    managerEmployeeId,
    nonStandard: nonStandard ?? false,
    ...(justification ? { justification } : {}),
  };

  await logService.log(
    `[hardware-request] stub: would POST to ${endpoint} for "${item.name}" (employee ${employeeId}): ${JSON.stringify(requestBody)}`,
    AppLogSeverity.Info,
    "hardwareRequest",
  );

  // TODO: implement when hardware platform contract is confirmed (§9.1.2):
  // const response = await fetch(endpoint, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(requestBody),
  // });
  // if (!response.ok) throw new Error(`Hardware API returned ${response.status}`);
  // return (await response.json()) as Record<string, unknown>;

  return { stub: true, item: item.name, employeeId, endpoint };
}
