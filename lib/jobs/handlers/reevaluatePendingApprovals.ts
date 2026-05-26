import { approvalService } from "@/lib/services/approvalService";

export async function reevaluatePendingApprovalsHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await approvalService.reevaluatePendingRequests();
  return { success: true };
}
