"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { Employee } from "@/generated/prisma_client";

export default function Page() {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniqueEmployees, setUniqueEmployees] = useState<number>(0);
  const [rowCount, setRowCount] = useState<number>(0);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get(
          `/api/requirements?allIncompleteTickets=true`,
        );
        setAllEmployees(response.data.employees);
        setUniqueEmployees(response.data.uniqueEmployees);
        setRowCount(response.data.totalRows);
      } catch (error) {
        console.error("Error fetching employees", error);
        setError("Error fetching employees");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        Individual Ticket Needs Analysis Report
      </h1>

      {/* Loading state */}
      {loading && <div className="text-center py-8">Loading...</div>}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Data table */}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {uniqueEmployees} unique employee(s) across {rowCount}{" "}
              row(s)
            </div>
            <ExportButtons
              data={allEmployees}
              columns={columns}
              filename={`ticket-requirements-complete)}`}
              title={`Ticket Requirements Report`}
            />
          </div>
          <DataTable columns={columns} data={allEmployees} />
        </div>
      )}
    </div>
  );
}
