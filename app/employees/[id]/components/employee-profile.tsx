"use client";

import { EmployeeProvider } from "./employee-context";
import { EmployeeHeader } from "./employee-header";
import { EmployeeTabs } from "./employee-tabs";
import { useSession } from "next-auth/react";

interface Props {
  employeeId: number;
}

export function EmployeeProfile({ employeeId }: Props) {
  const session = useSession();

  return (
    <EmployeeProvider employeeId={employeeId}>
      <div className="min-h-screen bg-background">
        <EmployeeHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EmployeeTabs />
        </div>
      </div>
    </EmployeeProvider>
  );
}
