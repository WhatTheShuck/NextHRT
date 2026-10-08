import { accountOnboardingService } from "@/lib/services/accountOnboardingService";

/**
 * ACCOUNT_LINK_DIGEST — weekly summary to admins of signed-in accounts still
 * waiting to be linked to an employee record.
 */
export async function accountLinkDigestHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return accountOnboardingService.sendWaitingDigest();
}
