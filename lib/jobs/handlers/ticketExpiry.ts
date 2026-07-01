import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { appSettingService } from "@/lib/services/appSettingService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { resolveExpiryRecipients } from "@/lib/services/expiryNotificationRecipients";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function ticketExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const settings = await appSettingService.getSettings();
  const warnDays = Number(settings["tickets.expiryWarningDays"] ?? 30);
  const warnCutoff = new Date(now.getTime() + warnDays * DAY_MS);

  // All records that have an expiry and could matter (expired or expiring soon).
  const records = await prisma.ticketRecords.findMany({
    where: { expiryDate: { not: null, lte: warnCutoff } },
    include: {
      ticket: { select: { ticketName: true } },
      ticketHolder: { select: { legalFirstName: true, legalLastName: true } },
    },
  });

  // Determine the CURRENT record per (employeeId, ticketId): latest expiryDate,
  // tie dateIssued, tie id. We also need to know whether any *newer valid* record
  // exists, so fetch all records for affected pairs (a renewal supersedes an expiry).
  const pairKeys = new Set(records.map((r) => `${r.employeeId}:${r.ticketId}`));
  const allForPairs = await prisma.ticketRecords.findMany({
    where: {
      OR: [...pairKeys].map((k) => {
        const [e, t] = k.split(":");
        return { employeeId: Number(e), ticketId: Number(t) };
      }),
    },
    select: { id: true, employeeId: true, ticketId: true, expiryDate: true, dateIssued: true },
  });

  const currentIdByPair = new Map<string, number>();
  for (const r of allForPairs) {
    const key = `${r.employeeId}:${r.ticketId}`;
    const cur = allForPairs.find((x) => x.id === currentIdByPair.get(key));
    if (!cur || isNewer(r, cur)) currentIdByPair.set(key, r.id);
  }

  let warned = 0;
  let expired = 0;

  for (const rec of records) {
    const key = `${rec.employeeId}:${rec.ticketId}`;
    if (currentIdByPair.get(key) !== rec.id) continue; // not the current record — skip (renewed)

    const isExpired = rec.expiryDate!.getTime() <= now.getTime();
    const empName = `${rec.ticketHolder.legalFirstName} ${rec.ticketHolder.legalLastName}`;
    const expiryStr = rec.expiryDate!.toISOString().slice(0, 10);

    if (isExpired && rec.expiryNotificationStage !== "ExpiredSent") {
      await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: rec.employeeId });
      await sendExpiryEmail("ticket.expired", rec.employeeId, {
        employeeName: empName, ticketName: rec.ticket.ticketName, expiryDate: expiryStr, daysUntilExpiry: 0,
      });
      await prisma.ticketRecords.update({
        where: { id: rec.id },
        data: { expiryNotificationStage: "ExpiredSent" },
      });
      expired++;
    } else if (!isExpired && rec.expiryNotificationStage === null) {
      const days = Math.ceil((rec.expiryDate!.getTime() - now.getTime()) / DAY_MS);
      await sendExpiryEmail("ticket.expiryWarning", rec.employeeId, {
        employeeName: empName, ticketName: rec.ticket.ticketName, expiryDate: expiryStr, daysUntilExpiry: days,
      });
      await prisma.ticketRecords.update({
        where: { id: rec.id },
        data: { expiryNotificationStage: "WarnSent" },
      });
      warned++;
    }
  }

  return { warned, expired };
}

function isNewer(
  a: { expiryDate: Date | null; dateIssued: Date; id: number },
  b: { expiryDate: Date | null; dateIssued: Date; id: number },
): boolean {
  const ae = a.expiryDate?.getTime() ?? Infinity; // null expiry = never expires = newest
  const be = b.expiryDate?.getTime() ?? Infinity;
  if (ae !== be) return ae > be;
  if (a.dateIssued.getTime() !== b.dateIssued.getTime()) return a.dateIssued > b.dateIssued;
  return a.id > b.id;
}

async function sendExpiryEmail(
  templateKey: string,
  employeeId: number,
  vars: Record<string, string | number>,
): Promise<void> {
  const recipients = await resolveExpiryRecipients(employeeId);
  if (recipients.to.length === 0) return;
  const { subject, body } = await emailTemplateService.render(templateKey, vars);
  await enqueue("SEND_EMAIL", { to: recipients.to, cc: recipients.cc, subject, text: body });
}
