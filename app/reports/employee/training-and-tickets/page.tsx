"use client";

import { useMemo, useState } from "react";
import { EmployeeReportShell } from "../employee-report-shell";
import { ExpiredTicketsToggle } from "../expired-tickets-toggle";
import { useEmployeeRecords } from "../use-employee-records";
import { toCombinedRows } from "../record-rows";
import { columns } from "./columns";

export default function EmployeeTrainingAndTicketsReportPage() {
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

  const [includeExpiredTickets, setIncludeExpiredTickets] = useState(false);

  const rows = useMemo(
    () =>
      toCombinedRows(
        employee?.trainingRecords,
        employee?.ticketRecords,
        includeExpiredTickets,
      ),
    [employee, includeExpiredTickets],
  );

  return (
    <EmployeeReportShell
      heading="Employee Training & Ticket Records"
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
      exportSlug="training-and-ticket-records"
      exportTitle="Training & Ticket Records"
      recordNoun="record"
    >
      <ExpiredTicketsToggle
        checked={includeExpiredTickets}
        onCheckedChange={setIncludeExpiredTickets}
      />
    </EmployeeReportShell>
  );
}
