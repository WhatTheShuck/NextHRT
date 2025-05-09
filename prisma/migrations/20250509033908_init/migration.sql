/*
  Warnings:

  - Added the required column `Department` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Location` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "WorkAreaID" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "StartDate" DATETIME,
    "FinishDate" DATETIME,
    "Department" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Employee" ("FinishDate", "IsActive", "StartDate", "Title", "WorkAreaID", "createdAt", "firstName", "id", "lastName", "updatedAt") SELECT "FinishDate", "IsActive", "StartDate", "Title", "WorkAreaID", "createdAt", "firstName", "id", "lastName", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
