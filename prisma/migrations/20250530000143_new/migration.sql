/*
  Warnings:

  - You are about to drop the column `renewalPeriod` on the `Training` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `TrainingRecords` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TicketRecords" ADD COLUMN "expiryDate" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Training" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL
);
INSERT INTO "new_Training" ("category", "id", "title") SELECT "category", "id", "title" FROM "Training";
DROP TABLE "Training";
ALTER TABLE "new_Training" RENAME TO "Training";
CREATE TABLE "new_TrainingRecords" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "dateCompleted" DATETIME NOT NULL,
    "trainingId" INTEGER NOT NULL,
    "trainer" TEXT NOT NULL,
    "imagePath" TEXT,
    "imageType" TEXT,
    CONSTRAINT "TrainingRecords_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRecords_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TrainingRecords" ("dateCompleted", "employeeId", "id", "imagePath", "imageType", "trainer", "trainingId") SELECT "dateCompleted", "employeeId", "id", "imagePath", "imageType", "trainer", "trainingId" FROM "TrainingRecords";
DROP TABLE "TrainingRecords";
ALTER TABLE "new_TrainingRecords" RENAME TO "TrainingRecords";
CREATE UNIQUE INDEX "TrainingRecords_employeeId_trainingId_dateCompleted_key" ON "TrainingRecords"("employeeId", "trainingId", "dateCompleted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
