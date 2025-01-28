"use client";
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableColumn } from "@/lib/export-utils";
import { Employee } from "@prisma/client";
import { ExportButtons } from "@/components/ExportButtons";

// Define columns configuration
const columns: TableColumn[] = [
  { header: "First Name", accessor: "firstName" },
  { header: "Last Name", accessor: "lastName" },
  { header: "Title", accessor: "Title" },
  {
    header: "Work Area",
    accessor: "WorkAreaID",
    // Optional: Add format function if you want to transform the WorkAreaID
    format: (value: number) => `Area ${value}`,
  },
  {
    header: "Location",
    accessor: "location",
    format: () => "-", // Placeholder until implemented
  },
  {
    header: "Department",
    accessor: "department",
    format: () => "-", // Placeholder until implemented
  },
];

export default function EmployeeTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch("/api/employees");
        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }
        const data = await response.json();
        setEmployees(data.filter((emp: Employee) => emp.IsActive));
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading employees...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <ExportButtons
        data={employees}
        columns={columns}
        filename="active-employees"
        title="Active Employees Report"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.accessor}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                {columns.map((column) => (
                  <TableCell key={`${employee.id}-${column.accessor}`}>
                    {column.format
                      ? column.format(employee[column.accessor])
                      : employee[column.accessor]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
