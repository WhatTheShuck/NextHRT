/*
  Warnings:

  - You are about to drop the `Authenticator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `Department` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `FinishDate` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `IsActive` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `Location` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `StartDate` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `Title` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `WorkAreaID` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `RenewalPeriod` on the `Training` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TrainingRecords` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `TrainingRecords` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TrainingRecords` table. All the data in the column will be lost.
  - Added the required column `businessArea` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `job` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationId` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Authenticator_credentialID_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Authenticator";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketCode" TEXT NOT NULL,
    "ticketName" TEXT NOT NULL,
    "renewal" INTEGER NOT NULL DEFAULT 12
);

-- CreateTable
CREATE TABLE "TicketRecords" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "dateIssued" DATETIME NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "licenseNumber" TEXT,
    "imagePath" TEXT,
    "imageType" TEXT,
    CONSTRAINT "TicketRecords_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TicketRecords_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "History" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableName" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "changedFields" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "userId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "History_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DepartmentManager" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DepartmentManager_A_fkey" FOREIGN KEY ("A") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DepartmentManager_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATETIME,
    "finishDate" DATETIME,
    "departmentId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "businessArea" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "notes" TEXT,
    "usi" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("firstName", "id", "lastName") SELECT "firstName", "id", "lastName" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE TABLE "new_Training" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "renewalPeriod" INTEGER NOT NULL DEFAULT 12
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
    CONSTRAINT "TrainingRecords_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRecords_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TrainingRecords" ("dateCompleted", "employeeId", "id", "trainer", "trainingId") SELECT "dateCompleted", "employeeId", "id", "trainer", "trainingId" FROM "TrainingRecords";
DROP TABLE "TrainingRecords";
ALTER TABLE "new_TrainingRecords" RENAME TO "TrainingRecords";
CREATE UNIQUE INDEX "TrainingRecords_employeeId_trainingId_dateCompleted_key" ON "TrainingRecords"("employeeId", "trainingId", "dateCompleted");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT DEFAULT 'User',
    "employeeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_state_key" ON "Location"("name", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "TicketRecords_employeeId_ticketId_dateIssued_key" ON "TicketRecords"("employeeId", "ticketId", "dateIssued");

-- CreateIndex
CREATE UNIQUE INDEX "_DepartmentManager_AB_unique" ON "_DepartmentManager"("A", "B");

-- CreateIndex
CREATE INDEX "_DepartmentManager_B_index" ON "_DepartmentManager"("B");
