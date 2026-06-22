import "server-only";
import { transporter } from "@/lib/mail";
import { enqueue } from "@/lib/jobs/jobQueue";
import { logService } from "@/lib/services/logService";
import { AppLogSeverity } from "@/generated/prisma_client/enums";

export interface MailAttachment {
  filename?: string;
  path?: string;
  contentType?: string;
}

export interface MailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: MailAttachment[];
}

const DEFAULT_FROM = process.env.MAIL_FROM ?? '"HRT" <HRT@ksb.com>';

function formatRecipients(to: MailParams["to"]): string {
  return Array.isArray(to) ? to.join(", ") : to;
}

class MailService {
  /**
   * Queue an email for asynchronous delivery via the SEND_EMAIL background job.
   * Returns immediately; delivery success/failure is recorded on the BackgroundJob
   * row and in the application log. This is the default for notifications.
   *
   * Note: jobQueue dedupes identical Pending payloads, so two byte-identical emails
   * queued before the first runs will collapse into one. Add a distinguishing field
   * (e.g. a per-event id) if you ever need to force duplicates through.
   */
  async send(params: MailParams): Promise<void> {
    await enqueue("SEND_EMAIL", params as unknown as Record<string, unknown>);
  }

  /**
   * Send an email immediately, awaiting the SMTP exchange. Use only when the caller
   * must confirm delivery before continuing (e.g. password reset). Throws on failure.
   */
  async sendNow(params: MailParams): Promise<{ messageId: string }> {
    try {
      const info = await transporter.sendMail({
        from: params.from ?? DEFAULT_FROM,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments,
      });

      await logService.log(
        `Email sent to ${formatRecipients(params.to)}: "${params.subject}"`,
        AppLogSeverity.Info,
        "mailService",
      );

      return { messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logService.log(
        `Email failed to ${formatRecipients(params.to)}: "${params.subject}" — ${message}`,
        AppLogSeverity.Error,
        "mailService",
      );
      throw err;
    }
  }
}

export const mailService = new MailService();
