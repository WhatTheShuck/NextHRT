"use client";

import React from "react";
import { Archive } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/table-component";
import { ExportButtons } from "@/components/ExportButtons";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { EmployeeWithRelations } from "@/lib/types";

interface EmployeeReportShellProps<T> {
  heading: string;
  /** Employees offered in the combobox, already filtered by the toggle. */
  employees: EmployeeWithRelations[];
  selectedEmployeeId: number | null;
  employeeName: string;
  includeInactiveEmployees: boolean;
  onEmployeeSelect: (employeeId: string) => void;
  onInactiveEmployeesToggle: (checked: boolean) => void;
  loading: boolean;
  error: string | null;
  rows: T[];
  columns: ColumnDef<T, unknown>[];
  /** Slug used for the exported file name, e.g. "training-records". */
  exportSlug: string;
  /** Human label for the exported document title, e.g. "Training Records". */
  exportTitle: string;
  /** Noun used in the record count line, e.g. "training record". */
  recordNoun: string;
  /** Extra toggles rendered beside the inactive-employee switch. */
  children?: React.ReactNode;
}

/**
 * Layout shared by the three per-employee record reports: employee picker,
 * inactive-employee toggle, export buttons and the data table.
 */
export function EmployeeReportShell<T extends Record<string, unknown>>({
  heading,
  employees,
  selectedEmployeeId,
  employeeName,
  includeInactiveEmployees,
  onEmployeeSelect,
  onInactiveEmployeesToggle,
  loading,
  error,
  rows,
  columns,
  exportSlug,
  exportTitle,
  recordNoun,
  children,
}: EmployeeReportShellProps<T>) {
  const [sortedData, setSortedData] = React.useState<T[]>([]);
  const [isSorted, setIsSorted] = React.useState(false);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">{heading}</h1>

      {/* Configuration toggles */}
      <div className="bg-muted/50 border rounded-lg p-4 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center space-x-2">
            <Switch
              id="inactive-employees"
              checked={includeInactiveEmployees}
              onCheckedChange={onInactiveEmployeesToggle}
            />
            <Label
              htmlFor="inactive-employees"
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Include inactive employees
            </Label>
          </div>
          {children}
        </div>
      </div>

      {/* Employee selection */}
      <div className="mb-6">
        <EmployeeCombobox
          employees={employees}
          selectedEmployeeId={selectedEmployeeId?.toString() ?? null}
          onSelect={onEmployeeSelect}
        />
      </div>

      {loading && (
        <div className="space-y-2 py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-4 text-destructive bg-destructive/10 rounded-lg p-4">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {selectedEmployeeId && !loading && !error && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <ExportButtons
              data={rows}
              columns={columns}
              filename={`${employeeName || "employee"}-${exportSlug}`}
              title={`${employeeName} - ${exportTitle}`}
              sortedData={sortedData}
              isSorted={isSorted}
            />

            <p className="font-medium text-sm text-muted-foreground">
              {rows.length} {recordNoun}
              {rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            onSortedDataChange={(data, sorted) => {
              setSortedData(data);
              setIsSorted(sorted);
            }}
          />
        </div>
      )}
    </div>
  );
}
