// Better Auth 1.7 identifies Microsoft Entra accounts by the `oid` claim
// instead of `sub`. Accounts created under 1.6 still store `sub`, so sign-in
// fails with `account_not_linked`. This rewrites each Microsoft account's
// accountId to the `oid` from its stored id_token.
//
//   pnpm tsx scripts/migrate-microsoft-account-ids.ts          # dry run
//   pnpm tsx scripts/migrate-microsoft-account-ids.ts --apply
import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const APPLY = process.argv.includes("--apply");

function claimsOf(idToken: string): { sub?: unknown; oid?: unknown } | null {
  try {
    return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

async function main() {
  const accounts = await prisma.account.findMany({
    where: { providerId: "microsoft" },
    select: { id: true, userId: true, accountId: true, idToken: true, user: { select: { email: true } } },
  });
  const existingIds = new Set(accounts.map((a) => a.accountId));

  let migrated = 0;
  let skipped = 0;
  for (const a of accounts) {
    const claims = a.idToken ? claimsOf(a.idToken) : null;
    const oid = typeof claims?.oid === "string" ? claims.oid : null;
    const label = `account ${a.id} (${a.user.email})`;

    if (!oid) {
      console.log(`  SKIP ${label}: no id_token with an oid claim`);
      skipped++;
    } else if (a.accountId === oid) {
      skipped++; // already migrated
    } else if (existingIds.has(oid)) {
      console.log(`  SKIP ${label}: another account already uses oid ${oid}`);
      skipped++;
    } else {
      console.log(`  ${label}: ${a.accountId} -> ${oid}`);
      if (APPLY) {
        await prisma.account.update({ where: { id: a.id }, data: { accountId: oid } });
      }
      migrated++;
    }
  }

  console.log(`${migrated} to migrate, ${skipped} skipped.`);
  console.log(APPLY ? "Applied." : "Dry run — re-run with --apply to write changes.");
}

main().finally(() => prisma.$disconnect());
