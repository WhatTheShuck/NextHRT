import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { appLink } from "@/lib/appUrl";
import { escapeHtml } from "@/lib/email-templates/tokens";
import { appSettingService } from "@/lib/services/appSettingService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { findMissingItems, type MissingItem } from "@/lib/services/missingItems";
import { DAY_MS } from "@/lib/services/ticketExpiryShared";
import {
  EMPLOYEE_ADDRESS_SELECT,
  UNLINKED_NOTE,
  employeeAddress,
  employeeDisplayName,
} from "@/lib/services/employeeAddress";

/**
 * Reminds employees about required tickets / External training they haven't provided
 * (spec "MISSING_DOCUMENT_REMINDER"): a first notice the night a gap appears, then a digest
 * every documents.missingReminderIntervalDays while any stays open. Enqueued by the nightly
 * requirements cache rebuild so it always reads a fresh cache.
 */

const key = (employeeId: number, kind: string, itemId: number) => `${employeeId}:${kind}:${itemId}`;

export async function missingDocumentReminderHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const settings = await appSettingService.getSettings();
  const intervalDays = Number(settings["documents.missingReminderIntervalDays"]) > 0
    ? Number(settings["documents.missingReminderIntervalDays"])
    : 30;
  const dueBefore = new Date(now.getTime() - intervalDays * DAY_MS);

  const gaps = await findMissingItems({ isActive: true });
  const gapKeys = new Set(gaps.map((g) => key(g.employeeId, g.kind, g.itemId)));

  // Rows of inactive employees are left alone so a rehire picks up where it stopped.
  const rows = await prisma.missingDocumentReminder.findMany({ where: { employee: { isActive: true } } });
  const rowByKey = new Map(rows.map((r) => [key(r.employeeId, r.itemType, r.itemId), r]));

  const closed = rows.filter((r) => !gapKeys.has(key(r.employeeId, r.itemType, r.itemId)));
  if (closed.length > 0) {
    await prisma.missingDocumentReminder.deleteMany({ where: { id: { in: closed.map((r) => r.id) } } });
  }
  const fresh = gaps.filter((g) => !rowByKey.has(key(g.employeeId, g.kind, g.itemId)));
  if (fresh.length > 0) {
    await prisma.missingDocumentReminder.createMany({
      data: fresh.map((g) => ({ employeeId: g.employeeId, itemType: g.kind, itemId: g.itemId })),
    });
  }

  // An open upload means the employee has acted: keep the row, don't nag.
  const open = await prisma.documentSubmission.findMany({
    where: { status: { in: ["Pending", "ChangesRequested"] }, employeeId: { in: [...new Set(gaps.map((g) => g.employeeId))] } },
    select: { employeeId: true, kind: true, ticketId: true, trainingId: true },
  });
  const openKeys = new Set(open.map((o) => key(o.employeeId, o.kind, (o.ticketId ?? o.trainingId)!)));

  const byEmployee = new Map<number, MissingItem[]>();
  for (const g of gaps) {
    if (openKeys.has(key(g.employeeId, g.kind, g.itemId))) continue;
    byEmployee.set(g.employeeId, [...(byEmployee.get(g.employeeId) ?? []), g]);
  }

  const due = [...byEmployee.entries()].filter(([, items]) =>
    items.some((g) => {
      const r = rowByKey.get(key(g.employeeId, g.kind, g.itemId));
      return !r || !r.firstNotifiedAt || !r.lastNotifiedAt || r.lastNotifiedAt <= dueBefore;
    }),
  );
  if (due.length === 0) return { gaps: gaps.length, closed: closed.length, emailed: 0 };

  const employees = await prisma.employee.findMany({
    where: { id: { in: due.map(([id]) => id) } },
    select: EMPLOYEE_ADDRESS_SELECT,
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  let emailed = 0;
  for (const [employeeId, items] of due) {
    const employee = employeeById.get(employeeId);
    if (!employee) continue;

    const rows = items.map((g) => ({
      itemName: escapeHtml(g.itemName),
      itemKind: g.kind === "Ticket" ? "Ticket" : g.reason === "RetrainingRequired" ? "Training — retraining required" : "Training",
      uploadUrl: appLink(`/forms/document-upload?employeeId=${employeeId}&kind=${g.kind}&itemId=${g.itemId}`),
    }));
    const itemList = await emailTemplateService.renderList("document.missing", rows);
    const rendered = await emailTemplateService.render("document.missing", {
      employeeName: escapeHtml(employeeDisplayName(employee)),
      itemList,
      count: items.length,
      pageUrl: appLink("/expiring?tab=missing"),
      unlinkedNote: employee.User ? "" : UNLINKED_NOTE,
    });
    if (!rendered) break; // switched off: send none, mark none

    await enqueue("SEND_EMAIL", { to: employeeAddress(employee), subject: rendered.subject, html: rendered.body });
    const listed = { employeeId, OR: items.map((g) => ({ itemType: g.kind, itemId: g.itemId })) };
    await prisma.missingDocumentReminder.updateMany({ where: { ...listed, firstNotifiedAt: null }, data: { firstNotifiedAt: now } });
    await prisma.missingDocumentReminder.updateMany({ where: listed, data: { lastNotifiedAt: now } });
    emailed++;
  }

  return { gaps: gaps.length, closed: closed.length, emailed };
}
