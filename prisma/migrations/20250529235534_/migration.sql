-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketCode" TEXT NOT NULL,
    "ticketName" TEXT NOT NULL,
    "renewal" INTEGER NOT NULL
);
INSERT INTO "new_Ticket" ("id", "renewal", "ticketCode", "ticketName") SELECT "id", "renewal", "ticketCode", "ticketName" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE UNIQUE INDEX "Ticket_ticketCode_key" ON "Ticket"("ticketCode");
CREATE TABLE "new_Training" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "renewalPeriod" INTEGER NOT NULL
);
INSERT INTO "new_Training" ("category", "id", "renewalPeriod", "title") SELECT "category", "id", "renewalPeriod", "title" FROM "Training";
DROP TABLE "Training";
ALTER TABLE "new_Training" RENAME TO "Training";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
