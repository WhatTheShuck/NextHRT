/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,trainingId,dateCompleted]` on the table `TrainingRecords` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecords_employeeId_trainingId_dateCompleted_key" ON "TrainingRecords"("employeeId", "trainingId", "dateCompleted");
