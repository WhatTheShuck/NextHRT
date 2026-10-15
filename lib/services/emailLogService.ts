import { existsSync } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma_client/client";

// Every outgoing email is a SEND_EMAIL BackgroundJob (mailService.send queues
// one; nothing purges them), so the job table doubles as the email log. The
// only sends that bypass it are template test sends, which go out directly and
// are recorded in the admin log instead.

export type EmailLogStatus =
  | "Sent"
  | "Queued"
  | "Scheduled"
  | "Retrying"
  | "Sending"
  | "Failed"
  | "Cancelled";

/** Filter values accepted by list(). "queued" covers everything not yet sent. */
export type EmailLogFilter = "sent" | "queued" | "failed" | "cancelled";

export interface EmailLogEntry {
  id: number;
  status: EmailLogStatus;
  to: string;
  cc: string | null;
  subject: string;
  attachmentCount: number;
  attempts: number;
  errorMessage: string | null;
  createdAt: Date;
  scheduledAt: Date;
  completedAt: Date | null;
}

export interface EmailLogAttachment {
  filename: string;
  /** Stored on disk (vs. generated inline, e.g. a calendar invite). */
  isFile: boolean;
  /** For stored files: whether the file still exists. Inline is always true. */
  exists: boolean;
}

export interface EmailLogDetail extends EmailLogEntry {
  bcc: string | null;
  replyTo: string | null;
  html: string | null;
  text: string | null;
  attachments: EmailLogAttachment[];
  messageId: string | null;
}

interface MailPayload {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: { filename?: string; path?: string }[];
}

type JobRow = {
  id: number;
  status: string;
  payload: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: Date;
  scheduledAt: Date;
  completedAt: Date | null;
};

const FILTER_STATUSES: Record<EmailLogFilter, Prisma.BackgroundJobWhereInput> = {
  sent: { status: "Completed" },
  queued: { status: { in: ["Pending", "Running"] } },
  failed: { status: "Failed" },
  cancelled: { status: "Cancelled" },
};

function joinRecipients(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

function parsePayload(raw: string | null): MailPayload {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MailPayload;
  } catch {
    return {};
  }
}

function emailStatus(job: JobRow, now: Date): EmailLogStatus {
  switch (job.status) {
    case "Completed":
      return "Sent";
    case "Running":
      return "Sending";
    case "Failed":
      return "Failed";
    case "Cancelled":
      return "Cancelled";
    default:
      if (job.attempts > 0) return "Retrying";
      return job.scheduledAt > now ? "Scheduled" : "Queued";
  }
}

function toEntry(job: JobRow, payload: MailPayload, now: Date): EmailLogEntry {
  return {
    id: job.id,
    status: emailStatus(job, now),
    to: joinRecipients(payload.to) ?? "",
    cc: joinRecipients(payload.cc),
    subject: payload.subject ?? "",
    attachmentCount: payload.attachments?.length ?? 0,
    attempts: job.attempts,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    scheduledAt: job.scheduledAt,
    completedAt: job.completedAt,
  };
}

class EmailLogService {
  async list(params: {
    filter?: EmailLogFilter;
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ emails: EmailLogEntry[]; total: number }> {
    const where: Prisma.BackgroundJobWhereInput = {
      type: "SEND_EMAIL",
      ...(params.filter ? FILTER_STATUSES[params.filter] : {}),
      // Recipients and subject live in the JSON payload; a substring match on
      // it is good enough for an admin search box.
      ...(params.search?.trim()
        ? { payload: { contains: params.search.trim() } }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.backgroundJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.backgroundJob.count({ where }),
    ]);

    const now = new Date();
    return {
      emails: jobs.map((j) => toEntry(j, parsePayload(j.payload), now)),
      total,
    };
  }

  async get(id: number): Promise<EmailLogDetail | null> {
    const job = await prisma.backgroundJob.findFirst({
      where: { id, type: "SEND_EMAIL" },
    });
    if (!job) return null;

    const payload = parsePayload(job.payload);
    let messageId: string | null = null;
    if (job.resultSummary) {
      try {
        messageId = JSON.parse(job.resultSummary).messageId ?? null;
      } catch {
        // ignore malformed summaries
      }
    }

    return {
      ...toEntry(job, payload, new Date()),
      bcc: joinRecipients(payload.bcc),
      replyTo: payload.replyTo ?? null,
      html: payload.html ?? null,
      text: payload.text ?? null,
      attachments: (payload.attachments ?? []).map((a) => ({
        filename: a.filename ?? (a.path ? path.basename(a.path) : "attachment"),
        isFile: !!a.path,
        exists: a.path ? existsSync(a.path) : true,
      })),
      messageId,
    };
  }

  /** Headline counts for the Email hub. */
  async stats(): Promise<{ sentLast7Days: number; queued: number; failed: number }> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [sentLast7Days, queued, failed] = await Promise.all([
      prisma.backgroundJob.count({
        where: { type: "SEND_EMAIL", status: "Completed", completedAt: { gte: weekAgo } },
      }),
      prisma.backgroundJob.count({
        where: { type: "SEND_EMAIL", status: { in: ["Pending", "Running"] } },
      }),
      prisma.backgroundJob.count({ where: { type: "SEND_EMAIL", status: "Failed" } }),
    ]);
    return { sentLast7Days, queued, failed };
  }
}

export const emailLogService = new EmailLogService();
