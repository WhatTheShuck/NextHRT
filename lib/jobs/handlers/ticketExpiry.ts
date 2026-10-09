import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { appSettingService } from "@/lib/services/appSettingService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { escapeHtml } from "@/lib/email-templates/tokens";
import { resolveExpiryRecipients } from "@/lib/services/expiryNotificationRecipients";
import { toCalendarDay } from "@/lib/dates";
import { appLink } from "@/lib/appUrl";
import {
  EMPLOYEE_ADDRESS_SELECT,
  UNLINKED_NOTE,
  employeeAddress,
  employeeDisplayName,
} from "@/lib/services/employeeAddress";
import {
  DAY_MS,
  DEFAULT_EMPLOYEE_MILESTONES,
  DEFAULT_MANAGER_MILESTONES,
  nextStage,
  parseMilestones,
  pickCurrentRecords,
  type ExpiryState,
} from "@/lib/services/ticketExpiryShared";

/**
 * Two independent reminder tracks per current ticket record
 * (docs/superpowers/specs/2026-10-09-document-upload-design.md "Jobs"):
 *   employee: every milestone in tickets.expiryReminderDays, stage in expiryNotificationStage,
 *             paused while a renewal upload is Pending;
 *   manager:  tickets.managerExpiryReminderDays (default 30) + expired, stage in
 *             managerExpiryNotificationStage.
 * Admins are not emailed.
 */

interface EmployeeItem {
  employeeId: number;
  address: string;
  employeeName: string;
  unlinked: boolean;
  ticketId: number;
  ticketName: string;
  expiryDate: string;
  days: number;
  expired: boolean;
}

interface ManagerItem {
  employeeName: string;
  ticketName: string;
  expiryDate: string;
  days: number;
  to: string[];
}

export async function ticketExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const settings = await appSettingService.getSettings();
  const employeeMilestones = parseMilestones(settings["tickets.expiryReminderDays"], DEFAULT_EMPLOYEE_MILESTONES);
  const managerMilestones = parseMilestones(settings["tickets.managerExpiryReminderDays"], DEFAULT_MANAGER_MILESTONES);
  // Only look as far ahead as the furthest milestone on either track.
  const warnCutoff = new Date(now.getTime() + Math.max(employeeMilestones[0], managerMilestones[0]) * DAY_MS);

  // Departed employees and deactivated ticket types have nothing left to chase. A rehire
  // re-activates the employee with their stages untouched, so reminders resume where they stopped.
  const records = await prisma.ticketRecords.findMany({
    where: {
      expiryDate: { not: null, lte: warnCutoff },
      ticketHolder: { isActive: true },
      ticket: { isActive: true },
    },
    include: {
      ticket: { select: { ticketName: true } },
      ticketHolder: { select: EMPLOYEE_ADDRESS_SELECT },
    },
  });
  if (records.length === 0) return { employeeNotified: 0, managerWarned: 0, managerExpired: 0 };

  // A renewal supersedes an expiry, so the current record is chosen across all of each pair's records.
  const pairs = [...new Set(records.map((r) => `${r.employeeId}:${r.ticketId}`))].map((k) => {
    const [employeeId, ticketId] = k.split(":").map(Number);
    return { employeeId, ticketId };
  });
  const allForPairs = await prisma.ticketRecords.findMany({
    where: { OR: pairs },
    select: { id: true, employeeId: true, ticketId: true, expiryDate: true, dateIssued: true },
  });
  const currentIds = new Set(pickCurrentRecords(allForPairs).map((r) => r.id));

  const pending = await prisma.documentSubmission.findMany({
    where: { status: "Pending", kind: "Ticket", employeeId: { in: pairs.map((p) => p.employeeId) } },
    select: { employeeId: true, ticketId: true },
  });
  const pendingRenewal = new Set(pending.map((p) => `${p.employeeId}:${p.ticketId}`));

  const employeeItems: EmployeeItem[] = [];
  const managerWarnings: ManagerItem[] = [];
  const managerExpiries: ManagerItem[] = [];

  for (const rec of records) {
    if (!currentIds.has(rec.id)) continue;
    const expired = rec.expiryDate!.getTime() <= now.getTime();
    const days = expired ? 0 : Math.ceil((rec.expiryDate!.getTime() - now.getTime()) / DAY_MS);
    const state: ExpiryState = expired ? { expired: true } : { expired: false, days };

    const employeeStage = pendingRenewal.has(`${rec.employeeId}:${rec.ticketId}`)
      ? null
      : nextStage(rec.expiryNotificationStage, state, employeeMilestones);
    const managerStage = nextStage(rec.managerExpiryNotificationStage, state, managerMilestones);
    if (!employeeStage && !managerStage) continue;

    // The manager track is never paused, so its first ExpiredSent marks "newly expired".
    if (managerStage === "ExpiredSent") {
      await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId: rec.employeeId });
    }

    const employeeName = employeeDisplayName(rec.ticketHolder);
    // Expiry dates descend from a local-midnight dateIssued; read the day in the app zone.
    const expiryDate = toCalendarDay(rec.expiryDate!);

    if (employeeStage) {
      employeeItems.push({
        employeeId: rec.employeeId,
        address: employeeAddress(rec.ticketHolder),
        employeeName,
        unlinked: !rec.ticketHolder.User,
        ticketId: rec.ticketId,
        ticketName: rec.ticket.ticketName,
        expiryDate,
        days,
        expired,
      });
    }
    if (managerStage) {
      const { to } = await resolveExpiryRecipients(rec.employeeId);
      if (to.length > 0) {
        (expired ? managerExpiries : managerWarnings).push({ employeeName, ticketName: rec.ticket.ticketName, expiryDate, days, to });
      }
    }

    await prisma.ticketRecords.update({
      where: { id: rec.id },
      data: {
        ...(employeeStage ? { expiryNotificationStage: employeeStage } : {}),
        ...(managerStage ? { managerExpiryNotificationStage: managerStage } : {}),
      },
    });
  }

  await sendEmployeeDigests(employeeItems);
  await sendManagerConsolidated("ticket.expiryWarning", managerWarnings, false);
  await sendManagerConsolidated("ticket.expired", managerExpiries, true);

  return {
    employeeNotified: new Set(employeeItems.map((i) => i.employeeId)).size,
    managerWarned: managerWarnings.length,
    managerExpired: managerExpiries.length,
  };
}

// One email per employee covering every ticket of theirs due a reminder this run.
async function sendEmployeeDigests(items: EmployeeItem[]): Promise<void> {
  const byEmployee = new Map<number, EmployeeItem[]>();
  for (const i of items) byEmployee.set(i.employeeId, [...(byEmployee.get(i.employeeId) ?? []), i]);

  for (const group of byEmployee.values()) {
    const first = group[0];
    const rows = [...group]
      .sort((a, b) => a.days - b.days)
      .map((i) => ({
        itemName: escapeHtml(i.ticketName),
        expiryDate: i.expiryDate,
        daysText: i.expired ? "expired" : `expires in ${i.days} day${i.days === 1 ? "" : "s"}`,
        uploadUrl: appLink(`/forms/document-upload?employeeId=${i.employeeId}&kind=Ticket&itemId=${i.ticketId}`),
      }));
    const itemList = await emailTemplateService.renderList("document.employeeExpiry", rows);
    const rendered = await emailTemplateService.render("document.employeeExpiry", {
      employeeName: escapeHtml(first.employeeName),
      itemList,
      count: group.length,
      pageUrl: appLink("/expiring"),
      unlinkedNote: first.unlinked ? UNLINKED_NOTE : "",
    });
    if (!rendered) continue; // switched off in the template editor
    await enqueue("SEND_EMAIL", { to: first.address, subject: rendered.subject, html: rendered.body });
  }
}

// Group by identical recipient set and send one email per group, as before.
async function sendManagerConsolidated(templateKey: string, items: ManagerItem[], expiredMode: boolean): Promise<void> {
  const groups = new Map<string, { to: string[]; items: ManagerItem[] }>();
  for (const item of items) {
    const to = [...item.to].sort();
    const sig = JSON.stringify(to);
    const group = groups.get(sig) ?? { to, items: [] };
    group.items.push(item);
    groups.set(sig, group);
  }

  for (const group of groups.values()) {
    const rows = [...group.items]
      .sort((a, b) => a.days - b.days)
      .map((i) => ({
        employeeName: escapeHtml(i.employeeName),
        ticketName: escapeHtml(i.ticketName),
        expiryDate: i.expiryDate,
        days: i.days,
        daysText: expiredMode ? "" : `${i.days} day${i.days === 1 ? "" : "s"}`,
      }));
    const ticketList = await emailTemplateService.renderList(templateKey, rows);
    const rendered = await emailTemplateService.render(templateKey, { ticketList, count: group.items.length });
    if (!rendered) continue; // switched off: skip this send only
    await enqueue("SEND_EMAIL", { to: group.to, subject: rendered.subject, html: rendered.body });
  }
}
