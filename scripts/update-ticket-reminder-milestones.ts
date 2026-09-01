/**
 * One-off: retire the 365-day (and 180-day) ticket expiry reminders.
 *
 * `appSettingService.ensureDefaults()` deliberately never overwrites a stored
 * value, so changing `SETTING_DEFAULTS` only affects fresh databases. This
 * script updates an already-seeded deployment.
 *
 * It only rewrites the value when it still matches a known legacy default —
 * a deliberately chosen milestone list is left alone. Pass --force to
 * overwrite regardless.
 *
 *   pnpm tsx scripts/update-ticket-reminder-milestones.ts          # dry run
 *   pnpm tsx scripts/update-ticket-reminder-milestones.ts --apply
 */
import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const KEY = "tickets.expiryReminderDays";
const NEW_VALUE = "90,60,30";
const LEGACY_VALUES = ["365,180,90,30"];

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

async function main() {
  const existing = await prisma.appSetting.findUnique({ where: { key: KEY } });

  if (!existing) {
    console.log(`No "${KEY}" row — ensureDefaults() will seed ${NEW_VALUE}. Nothing to do.`);
    return;
  }

  console.log(`Current: ${existing.value}`);

  if (existing.value === NEW_VALUE) {
    console.log("Already up to date. Nothing to do.");
    return;
  }

  if (!LEGACY_VALUES.includes(existing.value) && !FORCE) {
    console.log(
      "Value differs from the legacy default — assuming it was set deliberately.\n" +
        "Re-run with --force to overwrite it anyway.",
    );
    return;
  }

  console.log(`Would set: ${NEW_VALUE}`);

  if (!APPLY) {
    console.log("Dry run — re-run with --apply to write changes.");
    return;
  }

  await prisma.appSetting.update({
    where: { key: KEY },
    data: { value: NEW_VALUE, updatedBy: null },
  });

  // Mirrors appSettingService.updateSetting so the change shows in the
  // settings history tab. userId is null — this was a system migration.
  await prisma.history.create({
    data: {
      tableName: "AppSetting",
      recordId: KEY,
      action: "UPDATE",
      changedFields: JSON.stringify(["value"]),
      oldValues: JSON.stringify({ value: existing.value }),
      newValues: JSON.stringify({ value: NEW_VALUE }),
      userId: null,
    },
  });

  console.log("Applied.");
}

main().finally(() => prisma.$disconnect());
