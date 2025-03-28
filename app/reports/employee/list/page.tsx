"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { Employee } from "@prisma/client";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useState } from "react";

export default function Page() {
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
    <div className="container py-10 mx-auto">
      <div className="flex justify-between items-center mb-4">
        <ExportButtons
          data={employees}
          columns={columns}
          filename="active-employees"
          title="Active Employees Report"
        />
        <p className="font-medium"> Employee Count: {employees.length} </p>
      </div>
      <DataTable columns={columns} data={employees} />
    </div>
  );
}
