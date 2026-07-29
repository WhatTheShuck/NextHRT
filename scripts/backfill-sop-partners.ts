/**
 * backfill-sop-partners.ts
 *
 * One-off backfill for pre-existing SOP Training pairs. Trainings in category "SOP"
 * come in title-suffixed pairs ("X - Task Sheet" / "X - Practical"). Newly created
 * pairs already get sopPartnerId set at creation time (Tasks 1-2); this script links
 * the pairs that existed before that change.
 *
 * Resolution is pure and lives in lib/sop/pairing.ts (resolveSopPairs) — this script
 * is only I/O. Orphans/ambiguities are reported, never guessed.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-sop-partners.ts        # dry-run report (default)
 *   pnpm exec tsx scripts/backfill-sop-partners.ts --apply # apply changes
 */

import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveSopPairs } from "../lib/sop/pairing";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main() {
  const apply = process.argv.includes("--apply");

  const trainings = await prisma.training.findMany({
    where: { category: "SOP" },
    select: { id: true, title: true, sopPartnerId: true },
  });

  const { pairs, alreadyLinked, orphans } = resolveSopPairs(trainings);

  console.log(`SOP trainings: ${trainings.length}`);
  console.log(`Already linked: ${alreadyLinked.length}`);
  console.log(`Pairs to link: ${pairs.length}`);
  for (const p of pairs) {
    console.log(`  #${p.taskSheetId} "${p.baseTitle} - Task Sheet" -> #${p.practicalId}`);
  }
  if (orphans.length) {
    console.log(`\nORPHANS (not linked — resolve by hand):`);
    for (const o of orphans) console.log(`  #${o.id} "${o.title}": ${o.reason}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write the links.");
    return;
  }

  for (const p of pairs) {
    await prisma.training.update({
      where: { id: p.taskSheetId },
      data: { sopPartnerId: p.practicalId },
    });
  }
  console.log(`\nLinked ${pairs.length} pairs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
