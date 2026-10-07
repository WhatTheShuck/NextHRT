// Gives local dev accounts a password so they can sign in without Microsoft.
// Only takes effect when the dev server runs with NEXT_PUBLIC_DEV_AUTH=true
// (see lib/dev-auth.ts) — production never enables password sign-in, so the
// credential rows this writes are inert there.
//
//   pnpm dev:auth                        # create/refresh one persona per role
//   pnpm dev:auth --email a@ksb.com      # also give an existing user the password (repeatable)
//   pnpm dev:auth --all                  # give every existing user the password
//
// Password is DEV_AUTH_PASSWORD, or "password123".
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { DEV_PERSONAS } from "@/lib/dev-auth";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run with NODE_ENV=production.");
  process.exit(1);
}

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const PASSWORD = process.env.DEV_AUTH_PASSWORD ?? "password123";

function argValues(flag: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

async function setPassword(userId: string, hash: string) {
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: userId } },
    create: { userId, providerId: "credential", accountId: userId, password: hash },
    update: { password: hash },
  });
}

async function main() {
  const hash = await hashPassword(PASSWORD);

  // Written via Prisma rather than better-auth so the new-user hook (which
  // emails admins) doesn't fire for throwaway dev accounts.
  for (const p of DEV_PERSONAS) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      create: { email: p.email, name: p.name, role: p.role, emailVerified: true },
      update: { role: p.role },
    });
    await setPassword(user.id, hash);
    console.log(`  persona  ${p.email.padEnd(26)} ${p.role}`);
  }

  const existing = process.argv.includes("--all")
    ? await prisma.user.findMany({ where: { email: { not: null } } })
    : await prisma.user.findMany({ where: { email: { in: argValues("--email") } } });
  for (const u of existing) {
    if (DEV_PERSONAS.some((p) => p.email === u.email)) continue;
    await setPassword(u.id, hash);
    console.log(`  existing ${u.email!.padEnd(26)} ${u.role ?? "-"}`);
  }
  const missing = argValues("--email").filter((e) => !existing.some((u) => u.email === e));
  for (const e of missing) console.warn(`  NOT FOUND ${e}`);

  console.log(`\nPassword: ${PASSWORD}`);
  console.log("Start the server with NEXT_PUBLIC_DEV_AUTH=true (e.g. in .env.local) to use it.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
