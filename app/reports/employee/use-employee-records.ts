"use client";

import { useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import {
  EmployeeWithRelations,
  TicketRecordsWithRelations,
  TrainingRecordsWithRelations,
} from "@/lib/types";

/**
 * The single employee returned by `GET /api/employees/{id}`, which already
 * includes both record sets with their relations (training -> revisions,
 * ticket -> ticket).
 */
export interface EmployeeRecords extends EmployeeWithRelations {
  trainingRecords?: TrainingRecordsWithRelations[];
  ticketRecords?: TicketRecordsWithRelations[];
}

/**
 * Shared state for the per-employee reports: loads the employee list for the
 * combobox, honours the "include inactive" toggle, and fetches the selected
 * employee's training and ticket records.
 */
export function useEmployeeRecords() {
  const [allEmployees, setAllEmployees] = useState<EmployeeWithRelations[]>([]);
  const [employee, setEmployee] = useState<EmployeeRecords | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [includeInactiveEmployees, setIncludeInactiveEmployees] =
    useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEmployees = useMemo(
    () =>
      includeInactiveEmployees
        ? allEmployees
        : allEmployees.filter((emp) => emp.isActive),
    [allEmployees, includeInactiveEmployees],
  );

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response =
          await api.get<EmployeeWithRelations[]>("/api/employees");
        setAllEmployees(response.data);
      } catch (err) {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  const fetchRecords = async (employeeId: number) => {
    setLoadingRecords(true);
    setError(null);
    try {
      const response = await api.get<EmployeeRecords>(
        `/api/employees/${employeeId}`,
      );
      setEmployee(response.data);
    } catch (err) {
      setError(err instanceof AxiosError ? err.message : "An error occurred");
      setEmployee(null);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const selected = filteredEmployees.find(
      (emp) => emp.id.toString() === employeeId,
    );
    if (!selected) return;
    setSelectedEmployeeId(selected.id);
    fetchRecords(selected.id);
  };

  const handleInactiveEmployeesToggle = (checked: boolean) => {
    setIncludeInactiveEmployees(checked);
    // Drop the selection if the currently selected employee is filtered out.
    if (checked || !selectedEmployeeId) return;
    const selected = allEmployees.find((emp) => emp.id === selectedEmployeeId);
    if (selected && !selected.isActive) {
      setSelectedEmployeeId(null);
      setEmployee(null);
    }
  };

  const employeeName = employee
    ? `${employee.legalFirstName} ${employee.legalLastName}`
    : "";

  return {
    filteredEmployees,
    employee,
    employeeName,
    selectedEmployeeId,
    includeInactiveEmployees,
    handleEmployeeSelect,
    handleInactiveEmployeesToggle,
    loading: loadingEmployees || loadingRecords,
    error,
  };
}
