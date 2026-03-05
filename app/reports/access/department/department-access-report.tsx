"use client";

import React, { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/table-component";
import { ExportButtons } from "@/components/ExportButtons";

type Row = Record<string, unknown>;
import { DepartmentCombobox } from "@/components/combobox/department-combobox";
import { columns } from "./columns";
import { EmployeeAccessInfo } from "@/lib/services/accessCheckService";
import { Department } from "@/generated/prisma_client/client";
import api from "@/lib/axios";

export function DepartmentAccessReport() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [data, setData] = useState<EmployeeAccessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortedData, setSortedData] = useState<EmployeeAccessInfo[]>([]);
  const [isSorted, setIsSorted] = useState(false);
  const [fetchingDepts, setFetchingDepts] = useState(true);

  useEffect(() => {
    api
      .get<Department[]>("/api/departments")
      .then((r) => setDepartments(r.data))
      .catch(() => setError("Failed to load departments"))
      .finally(() => setFetchingDepts(false));
  }, []);

  const handleSelect = async (departmentId: string) => {
    const id = parseInt(departmentId, 10);
    setSelectedDepartmentId(id);
    setData([]);
    setError(null);
    setLoading(true);
    try {
      const r = await api.get<EmployeeAccessInfo[]>(
        `/api/access-check/report?scope=department&id=${id}`,
      );
      setData(r.data);
    } catch {
      setError("Failed to load access data");
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = departments.find((d) => d.id === selectedDepartmentId);

  return (
    <>
      <div className="max-w-xl mb-6">
        <DepartmentCombobox
          departments={departments}
          onSelect={handleSelect}
          selectedDepartmentId={selectedDepartmentId}
          disabled={fetchingDepts}
          placeholder={fetchingDepts ? "Loading departments..." : "Search and select a department..."}
        />
      </div>

      {loading && <div className="text-center py-4">Loading access data...</div>}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">{error}</div>
      )}

      {selectedDepartmentId && !loading && !error && (
        <div className="container py-6 mx-auto">
          <div className="flex justify-between items-center mb-4">
            <ExportButtons
              data={data as unknown as Row[]}
              columns={columns as unknown as ColumnDef<Row>[]}
              filename={`${selectedDept?.name ?? "department"}-access-report`}
              title={`${selectedDept?.name ?? "Department"} Access Report`}
              sortedData={sortedData as unknown as Row[]}
              isSorted={isSorted}
            />
            <p className="font-medium">Employee Count: {data.length}</p>
          </div>
          <DataTable
            columns={columns}
            data={data}
            onSortedDataChange={(d, sorted) => {
              setSortedData(d as EmployeeAccessInfo[]);
              setIsSorted(sorted);
            }}
          />
        </div>
      )}
    </>
  );
}
