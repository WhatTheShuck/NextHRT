"use client";

import { Employee, Training, TrainingRecords } from "@prisma/client";
import { EmployeeProvider } from "./employee-context";
import { EmployeeHeader } from "./employee-header";
import { EmployeeTabs } from "./employee-tabs";

interface Props {
  initialEmployee: Employee;
  initialTrainingRecords: (TrainingRecords & { training: Training })[];
  employeeId: number;
}

export function EmployeeProfile({
  initialEmployee,
  initialTrainingRecords,
  employeeId,
}: Props) {
  return (
    <EmployeeProvider
      initialEmployee={initialEmployee}
      initialTrainingRecords={initialTrainingRecords}
      employeeId={employeeId}
    >
      <div className="min-h-screen bg-background">
        <EmployeeHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EmployeeTabs />
        </div>
      </div>
    </EmployeeProvider>
  );
}
