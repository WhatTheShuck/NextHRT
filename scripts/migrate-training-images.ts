/**
 * Migration script: training imagePath/imageType -> TrainingImage table
 *
 * This script migrates existing single-image data from the TrainingRecords
 * table (imagePath, imageType columns) into the new TrainingImage join table,
 * mirroring the TicketImage pattern.
 *
 * Run BEFORE dropping imagePath/imageType from TrainingRecords:
 *   pnpm tsx scripts/migrate-training-images.ts
 *
 * Then apply the schema change:
 *   pnpm prisma db push --accept-data-loss
 */

import { PrismaClient } from "../generated/prisma_client";
import path from "path";

const prisma = new PrismaClient();

interface TrainingRecordRow {
  id: number;
  imagePath: string | null;
  imageType: string | null;
}

async function main() {
  console.log("Starting training image migration...");

  // Read the old columns via raw SQL (they may not be in the generated client
  // if the schema has already been updated ahead of the DB)
  const records = await prisma.$queryRawUnsafe<TrainingRecordRow[]>(
    `SELECT id, imagePath, imageType FROM TrainingRecords WHERE imagePath IS NOT NULL`,
  );

  console.log(`Found ${records.length} training records with images.`);

  if (records.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Create the TrainingImage table if it doesn't already exist
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TrainingImage" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "trainingRecordId" INTEGER NOT NULL,
      "imagePath" TEXT NOT NULL,
      "imageType" TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrainingImage_trainingRecordId_fkey"
        FOREIGN KEY ("trainingRecordId") REFERENCES "TrainingRecords"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TrainingImage_trainingRecordId_idx"
      ON "TrainingImage"("trainingRecordId")
  `);

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.imagePath || !record.imageType) {
      skipped++;
      continue;
    }

    // Check if already migrated (idempotent)
    const existing = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM TrainingImage WHERE trainingRecordId = ?`,
      record.id,
    );
    if (existing[0].count > 0) {
      skipped++;
      continue;
    }

    // Derive originalName from the file path (e.g. "training/uuid.jpg" -> "uuid.jpg")
    const originalName = path.basename(record.imagePath);

    await prisma.$executeRawUnsafe(
      `INSERT INTO TrainingImage (trainingRecordId, imagePath, imageType, originalName)
       VALUES (?, ?, ?, ?)`,
      record.id,
      record.imagePath,
      record.imageType,
      originalName,
    );

    migrated++;
  }

  console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
