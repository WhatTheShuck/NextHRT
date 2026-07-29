/**
 * seed-it-induction-quiz.ts
 *
 * One-off, idempotent seed for the IT Induction Questionnaire. Creates (or
 * reuses) an Internal training, ensures it has a revision, sets the validated
 * quiz content on that revision, and adds the single wildcard requirement
 * (departmentId: -1, locationId: -1) so every new starter — in any department
 * or location, now or later — is assigned it.
 *
 * Usage:
 *   pnpm exec tsx scripts/seed-it-induction-quiz.ts
 */

import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { parseQuizDocument } from "../lib/quiz/schema";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const TRAINING_TITLE = "IT Induction Questionnaire";

async function main() {
  const jsonPath = path.join(process.cwd(), "prisma", "seed-data", "it-induction-quiz.json");
  const raw = readFileSync(jsonPath, "utf8");
  // Validate + normalise before touching the DB.
  const doc = parseQuizDocument(raw);
  const content = JSON.stringify(doc);

  // 1. Training (find-or-create).
  let training = await prisma.training.findFirst({
    where: { title: TRAINING_TITLE },
    select: { id: true },
  });
  if (!training) {
    training = await prisma.training.create({
      data: { title: TRAINING_TITLE, category: "Internal", isActive: true },
      select: { id: true },
    });
    console.log(`Created training #${training.id} "${TRAINING_TITLE}"`);
  } else {
    console.log(`Reusing training #${training.id} "${TRAINING_TITLE}"`);
  }

  // 2. Revision (ensure at least one; reuse the earliest if present).
  let revision = await prisma.trainingRevision.findFirst({
    where: { trainingId: training.id },
    orderBy: { effectiveDate: "asc" },
    select: { id: true },
  });
  if (!revision) {
    revision = await prisma.trainingRevision.create({
      data: {
        trainingId: training.id,
        revisionLabel: "v1",
        effectiveDate: new Date(),
      },
      select: { id: true },
    });
    console.log(`Created revision #${revision.id}`);
  } else {
    console.log(`Reusing revision #${revision.id}`);
  }

  // 3. Quiz content.
  await prisma.trainingRevision.update({
    where: { id: revision.id },
    data: { quizContent: content },
  });
  console.log(`Set quiz content on revision #${revision.id}`);

  // 4. Wildcard requirement (all departments × all locations).
  await prisma.trainingRequirement.upsert({
    where: {
      trainingId_departmentId_locationId: {
        trainingId: training.id,
        departmentId: -1,
        locationId: -1,
      },
    },
    create: { trainingId: training.id, departmentId: -1, locationId: -1 },
    update: {},
  });
  console.log(`Ensured wildcard requirement (-1, -1) for training #${training.id}`);

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
