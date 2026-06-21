import { mailService, MailParams } from "@/lib/services/mailService";

export async function sendEmailHandler(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const params = payload as unknown as MailParams;

  // sendNow throws on failure, which the job runner records as errorMessage /
  // status=Failed. The returned object is stored in resultSummary.
  const { messageId } = await mailService.sendNow(params);

  return { messageId, to: params.to, subject: params.subject };
}
