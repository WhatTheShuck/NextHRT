import prisma from "@/lib/prisma";
import { findMissingItems } from "@/lib/services/missingItems";
import {
  DAY_MS, DEFAULT_EMPLOYEE_MILESTONES, DEFAULT_MANAGER_MILESTONES, nextStage, parseMilestones, pickCurrentRecords,
} from "@/lib/services/ticketExpiryShared";

// What the first night after the document-upload go-live would send (spec "Go-live check").
// Run against a prod snapshot AFTER the stage backfill:
//   DATABASE_URL=file:./prisma/dev.db pnpm tsx scripts/document-alerts-dry-run.ts

async function main() {
  const now = new Date();
  const settings = Object.fromEntries((await prisma.appSetting.findMany()).map((s) => [s.key, s.value]));
  const emp = parseMilestones(settings["tickets.expiryReminderDays"], DEFAULT_EMPLOYEE_MILESTONES);
  const mgr = parseMilestones(settings["tickets.managerExpiryReminderDays"], DEFAULT_MANAGER_MILESTONES);

  const records = await prisma.ticketRecords.findMany({
    where: { ticketHolder: { isActive: true }, ticket: { isActive: true } },
    select: {
      id: true, employeeId: true, ticketId: true, dateIssued: true, expiryDate: true,
      expiryNotificationStage: true, managerExpiryNotificationStage: true,
    },
  });
  const employeesEmailed = new Set<number>();
  let managerItems = 0;
  for (const r of pickCurrentRecords(records)) {
    if (!r.expiryDate) continue;
    const expired = r.expiryDate <= now;
    const state = expired ? { expired: true as const } : { expired: false as const, days: Math.ceil((r.expiryDate.getTime() - now.getTime()) / DAY_MS) };
    if (nextStage(r.expiryNotificationStage, state, emp)) employeesEmailed.add(r.employeeId);
    if (nextStage(r.managerExpiryNotificationStage, state, mgr)) managerItems++;
  }

  const missing = await findMissingItems({ isActive: true });
  const [ticketReqs, externalReqs] = await Promise.all([
    prisma.ticketRequirement.count(),
    prisma.trainingRequirement.count({ where: { training: { category: "External" } } }),
  ]);

  console.log(`Employee expiry digests:   ${employeesEmailed.size} employee(s)`);
  console.log(`Manager expiry items:      ${managerItems} (grouped into fewer emails, one per manager set; none if no manager)`);
  console.log(`Missing-item first notices: ${new Set(missing.map((m) => m.employeeId)).size} employee(s), ${missing.length} item(s)`);
  console.log(`Requirements configured:   ${ticketReqs} ticket, ${externalReqs} External training`);
  if (ticketReqs + externalReqs === 0) console.log("  → No requirements: missing-item reminders will send nothing.");
}

main().finally(() => prisma.$disconnect());
