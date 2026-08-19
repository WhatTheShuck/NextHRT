"use client";

import { useMemo } from "react";
import { EmployeeReportShell } from "../employee-report-shell";
import { useEmployeeRecords } from "../use-employee-records";
import { toTrainingRows } from "../record-rows";
import { columns } from "./columns";

export default function EmployeeTrainingReportPage() {
  const {
    filteredEmployees,
    employee,
    employeeName,
    selectedEmployeeId,
    includeInactiveEmployees,
    handleEmployeeSelect,
    handleInactiveEmployeesToggle,
    loading,
    error,
  } = useEmployeeRecords();

  const rows = useMemo(
    () => toTrainingRows(employee?.trainingRecords),
    [employee],
  );

  return (
    <EmployeeReportShell
      heading="Employee Training Records"
      employees={filteredEmployees}
      selectedEmployeeId={selectedEmployeeId}
      employeeName={employeeName}
      includeInactiveEmployees={includeInactiveEmployees}
      onEmployeeSelect={handleEmployeeSelect}
      onInactiveEmployeesToggle={handleInactiveEmployeesToggle}
      loading={loading}
      error={error}
      rows={rows}
      columns={columns}
      exportSlug="training-records"
      exportTitle="Training Records"
      recordNoun="training record"
    />
  );
}
