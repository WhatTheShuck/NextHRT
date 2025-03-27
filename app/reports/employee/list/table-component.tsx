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
  { header: "First Name", accessor: "firstName" as keyof Employee },
  { header: "Last Name", accessor: "lastName" as keyof Employee },
  { header: "Title", accessor: "Title" as keyof Employee },
  {
    header: "Work Area",
    accessor: "WorkAreaID" as keyof Employee,
    // Optional: Add format function if you want to transform the WorkAreaID
    format: (value: number) => `Area ${value}`,
  },
  {
    header: "Location",
    accessor: "Location" as keyof Employee,
  },
  {
    header: "Department",
    accessor: "Department" as keyof Employee,
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
    <div className="items-center">
      <div className="flex justify-between items-center mb-4">
        <ExportButtons
          data={employees}
          columns={columns}
          filename="active-employees"
          title="Active Employees Report"
        />
        <p className="font-medium"> Employee Count: {employees.length} </p>
      </div>
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
                      ? column.format(
                          employee[column.accessor as keyof Employee],
                        )
                      : employee[column.accessor as keyof Employee] instanceof
                          Date
                        ? (
                            employee[column.accessor as keyof Employee] as Date
                          ).toLocaleDateString()
                        : String(employee[column.accessor as keyof Employee])}
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
