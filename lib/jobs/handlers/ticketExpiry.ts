import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { appSettingService } from "@/lib/services/appSettingService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import {
  resolveExpiryRecipients,
  ExpiryRecipients,
} from "@/lib/services/expiryNotificationRecipients";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MILESTONES = [365, 180, 90, 30];

interface NotificationItem {
  employeeName: string;
  ticketName: string;
  expiryDate: string;
  days: number;
  recipients: ExpiryRecipients;
}

export async function ticketExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const settings = await appSettingService.getSettings();
  const milestones = parseMilestones(settings["tickets.expiryReminderDays"]);
  // Only look as far ahead as the furthest reminder milestone — this is what
  // stops reminders firing for tickets that expire years out.
  const maxMilestone = milestones[0] ?? DEFAULT_MILESTONES[0];
  const warnCutoff = new Date(now.getTime() + maxMilestone * DAY_MS);

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

  // Collect the notifications first, then send them consolidated per-recipient
  // below. This keeps managers of technician-heavy departments from receiving
  // one email per employee.
  const warnings: NotificationItem[] = [];
  const expiries: NotificationItem[] = [];
  let warned = 0;
  let expired = 0;

  for (const rec of records) {
    const key = `${rec.employeeId}:${rec.ticketId}`;
    if (currentIdByPair.get(key) !== rec.id) continue; // not the current record — skip (renewed)

    const isExpired = rec.expiryDate!.getTime() <= now.getTime();
    const empName = `${rec.ticketHolder.legalFirstName} ${rec.ticketHolder.legalLastName}`;
    const expiryStr = rec.expiryDate!.toISOString().slice(0, 10);
    const stage = rec.expiryNotificationStage;

    if (isExpired) {
      if (stage === "ExpiredSent") continue; // already notified — idempotent
      await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: rec.employeeId });
      const recipients = await resolveExpiryRecipients(rec.employeeId);
      if (recipients.to.length > 0) {
        expiries.push({
          employeeName: empName, ticketName: rec.ticket.ticketName,
          expiryDate: expiryStr, days: 0, recipients,
        });
      }
      await prisma.ticketRecords.update({
        where: { id: rec.id },
        data: { expiryNotificationStage: "ExpiredSent" },
      });
      expired++;
    } else {
      const days = Math.ceil((rec.expiryDate!.getTime() - now.getTime()) / DAY_MS);
      const milestone = applicableMilestone(days, milestones);
      if (milestone === null) continue; // beyond the furthest reminder — nothing to send yet
      // Stage stores the days-value of the last milestone reminder sent. Send
      // only when we've reached a nearer (smaller) milestone than last time.
      // Legacy stages ("WarnSent") parse to null and re-warn once at the
      // correct milestone.
      const lastSent = /^\d+$/.test(stage ?? "") ? Number(stage) : null;
      if (lastSent !== null && milestone >= lastSent) continue;
      const recipients = await resolveExpiryRecipients(rec.employeeId);
      if (recipients.to.length > 0) {
        warnings.push({
          employeeName: empName, ticketName: rec.ticket.ticketName,
          expiryDate: expiryStr, days, recipients,
        });
      }
      await prisma.ticketRecords.update({
        where: { id: rec.id },
        data: { expiryNotificationStage: String(milestone) },
      });
      warned++;
    }
  }

  await sendConsolidated("ticket.expiryWarning", warnings, false);
  await sendConsolidated("ticket.expired", expiries, true);

  return { warned, expired };
}

// Smallest milestone that still covers `days` (i.e. the tightest applicable
// reminder). `null` when `days` is beyond the furthest milestone.
function applicableMilestone(days: number, milestones: number[]): number | null {
  let result: number | null = null;
  for (const m of milestones) {
    if (days <= m) result = m; // milestones descending — keep tightening
  }
  return result;
}

function parseMilestones(raw: string | undefined): number[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const list = parsed.length > 0 ? parsed : DEFAULT_MILESTONES;
  return [...new Set(list)].sort((a, b) => b - a); // descending, deduped
}

// Group notifications by identical recipient set and send one email per group,
// each listing every affected employee/ticket.
async function sendConsolidated(
  templateKey: string,
  items: NotificationItem[],
  expiredMode: boolean,
): Promise<void> {
  if (items.length === 0) return;

  const groups = new Map<
    string,
    { recipients: ExpiryRecipients; items: NotificationItem[] }
  >();
  for (const item of items) {
    const to = [...item.recipients.to].sort();
    const cc = [...item.recipients.cc].sort();
    const sig = JSON.stringify([to, cc]);
    let group = groups.get(sig);
    if (!group) {
      group = { recipients: { to, cc }, items: [] };
      groups.set(sig, group);
    }
    group.items.push(item);
  }

  for (const group of groups.values()) {
    const ticketList = renderList(group.items, expiredMode);
    const { subject, body } = await emailTemplateService.render(templateKey, {
      ticketList,
      count: group.items.length,
    });
    await enqueue("SEND_EMAIL", {
      to: group.recipients.to,
      cc: group.recipients.cc,
      subject,
      html: body,
    });
  }
}

function renderList(items: NotificationItem[], expiredMode: boolean): string {
  const rows = [...items]
    .sort((a, b) => a.days - b.days) // most urgent first
    .map((i) =>
      expiredMode
        ? `<li>${esc(i.employeeName)} — ${esc(i.ticketName)}: expired ${i.expiryDate}</li>`
        : `<li>${esc(i.employeeName)} — ${esc(i.ticketName)}: expires ${i.expiryDate} (${i.days} day${i.days === 1 ? "" : "s"})</li>`,
    )
    .join("");
  return `<ul>${rows}</ul>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
