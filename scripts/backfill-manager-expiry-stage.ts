import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// One-off for the document-upload go-live (spec "Migration of stages"). Existing
// expiryNotificationStage values record emails sent to MANAGERS, so they become the manager
// track and the employee track starts empty. Employees then get one go-live digest of
// everything in their window, which is intended.
//
// Run after `prisma db push && prisma generate`, with the new code deployed and the app stopped:
//   pnpm tsx scripts/backfill-manager-expiry-stage.ts          # dry run
//   pnpm tsx scripts/backfill-manager-expiry-stage.ts --apply

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
const APPLY = process.argv.includes("--apply");

async function main() {
  const alreadyRun = await prisma.ticketRecords.count({ where: { managerExpiryNotificationStage: { not: null } } });
  if (alreadyRun > 0) {
    console.log(`${alreadyRun} record(s) already have a manager stage — this has been run. Nothing to do.`);
    return;
  }

  const rows = await prisma.ticketRecords.findMany({
    where: { expiryNotificationStage: { not: null } },
    select: { id: true, expiryNotificationStage: true },
  });
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.expiryNotificationStage!, (byStage.get(r.expiryNotificationStage!) ?? 0) + 1);
  console.log(`${rows.length} record(s) to move to the manager track:`);
  for (const [stage, n] of byStage) console.log(`  ${stage}: ${n}`);

  if (APPLY) {
    await prisma.$transaction(
      rows.map((r) =>
        prisma.ticketRecords.update({
          where: { id: r.id },
          data: { managerExpiryNotificationStage: r.expiryNotificationStage, expiryNotificationStage: null },
        }),
      ),
    );
  }
  console.log(APPLY ? "Applied." : "Dry run — re-run with --apply to write changes.");
}

main().finally(() => prisma.$disconnect());
