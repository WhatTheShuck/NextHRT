import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const APPLY = process.argv.includes("--apply");

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + years);
  return r;
}

async function main() {
  const candidates = await prisma.ticketRecords.findMany({
    where: { expiryDate: null, ticket: { renewal: { not: null } } },
    include: { ticket: { select: { ticketName: true, renewal: true } } },
  });

  console.log(`Found ${candidates.length} renewable ticket record(s) with null expiry:`);
  for (const r of candidates) {
    const newExpiry = addYears(r.dateIssued, r.ticket.renewal!);
    console.log(
      `  record #${r.id} employee ${r.employeeId} "${r.ticket.ticketName}" issued ${r.dateIssued.toISOString().slice(0, 10)} -> expiry ${newExpiry.toISOString().slice(0, 10)}`,
    );
    if (APPLY) {
      await prisma.ticketRecords.update({ where: { id: r.id }, data: { expiryDate: newExpiry } });
    }
  }

  console.log(APPLY ? "Applied." : "Dry run — re-run with --apply to write changes.");
}

main().finally(() => prisma.$disconnect());
