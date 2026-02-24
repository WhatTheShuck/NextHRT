"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { EmployeeWithRelations } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DateSelector } from "@/components/date-selector";

export default function Page() {
  const [allEmployees, setAllEmployees] = useState<EmployeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactiveEmployees, setIncludeInactiveEmployees] =
    useState(false);
  const [sortedData, setSortedData] = useState<EmployeeWithRelations[]>([]);
  const [isSorted, setIsSorted] = useState(false);

  // Set default dates to current year (Jan 1 to Dec 31)
  const [startedFrom, setStartedFrom] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1); // January 1st of current year
  });

  const [startedTo, setStartedTo] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31); // December 31st of current year
  });

  const fetchEmployees = async (from: Date, to: Date) => {
    setLoading(true);
    setError(null);
    try {
      // Format dates as ISO strings for the API
      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];

      const response = await api.get<EmployeeWithRelations[]>(
        `/api/employees?startedFrom=${fromStr}&startedTo=${toStr}`,
      );
      setAllEmployees(response.data);
    } catch (err) {
      setError(err instanceof AxiosError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees on mount and when date range changes
  useEffect(() => {
    fetchEmployees(startedFrom, startedTo);
  }, [startedFrom, startedTo]);

  // Compute filtered employees based on toggle
  const filteredEmployees = useMemo(() => {
    return includeInactiveEmployees
      ? allEmployees
      : allEmployees.filter((emp) => emp.isActive);
  }, [allEmployees, includeInactiveEmployees]);

  // Handle inactive employees toggle
  const handleInactiveEmployeesToggle = (checked: boolean) => {
    setIncludeInactiveEmployees(checked);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">New Hires Report</h1>

      {/* Configuration section */}
      <div className="p-4 rounded-lg mb-6 space-y-4 border">
        {/* Date range selectors */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <DateSelector
              selectedDate={startedFrom}
              onDateSelect={setStartedFrom}
              optional={false}
              placeholder="Started From"
            />
          </div>
          <div className="flex-1">
            <DateSelector
              selectedDate={startedTo}
              onDateSelect={setStartedTo}
              optional={false}
              placeholder="Started To"
            />
          </div>
        </div>

        {/* Toggle for inactive employees */}
        <div className="flex items-center space-x-2">
          <Switch
            id="inactive-employees"
            checked={includeInactiveEmployees}
            onCheckedChange={handleInactiveEmployeesToggle}
          />
          <Label
            htmlFor="inactive-employees"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Archive className="h-4 w-4" />
            Include inactive employees
          </Label>
        </div>
      </div>

      {/* Loading state */}
      {loading && <div className="text-centre py-8">Loading...</div>}

      {/* Error state */}
      {error && (
        <div className="text-centre py-8 text-red-500">Error: {error}</div>
      )}

      {/* Data table */}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-centre">
            <div className="text-sm text-muted-foreground">
              Showing {filteredEmployees.length} employee(s)
            </div>
            <ExportButtons
              data={filteredEmployees}
              columns={columns}
              filename="new-hires-report"
              title={`New Hires Report (${startedFrom.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${startedTo.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" })})`}
              sortedData={sortedData}
              isSorted={isSorted}
            />
          </div>
          <DataTable
            columns={columns}
            data={filteredEmployees}
            onSortedDataChange={(data, sorted) => {
              setSortedData(data as EmployeeWithRelations[]);
              setIsSorted(sorted);
            }}
          />
        </div>
      )}
    </div>
  );
}
