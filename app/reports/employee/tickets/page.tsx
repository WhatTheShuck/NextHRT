"use client";

import { useMemo, useState } from "react";
import { EmployeeReportShell } from "../employee-report-shell";
import { ExpiredTicketsToggle } from "../expired-tickets-toggle";
import { useEmployeeRecords } from "../use-employee-records";
import { toTicketRows } from "../record-rows";
import { columns } from "./columns";

export default function EmployeeTicketsReportPage() {
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
    () => toTicketRows(employee?.ticketRecords, includeExpiredTickets),
    [employee, includeExpiredTickets],
  );

  return (
    <EmployeeReportShell
      heading="Employee Ticket Records"
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
      exportSlug="ticket-records"
      exportTitle="Ticket Records"
      recordNoun="ticket record"
    >
      <ExpiredTicketsToggle
        checked={includeExpiredTickets}
        onCheckedChange={setIncludeExpiredTickets}
      />
    </EmployeeReportShell>
  );
}
