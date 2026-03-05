"use client";

import React, { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { DataTable } from "@/components/table-component";
import { ExportButtons } from "@/components/ExportButtons";
import { columns } from "./columns";
import { EmployeeAccessInfo } from "@/lib/services/accessCheckService";
import api from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";

type Row = Record<string, unknown>;

export function AllAccessReport() {
  const [data, setData] = useState<EmployeeAccessInfo[]>([]);
  const [filtered, setFiltered] = useState<EmployeeAccessInfo[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortedData, setSortedData] = useState<EmployeeAccessInfo[]>([]);
  const [isSorted, setIsSorted] = useState(false);

  const fetchData = async (activeOnly: boolean) => {
    setLoading(true);
    setError(null);
    setSelectedLocation(null);
    try {
      const r = await api.get<EmployeeAccessInfo[]>(
        `/api/access-check/report?scope=all&activeOnly=${activeOnly ? "true" : "false"}`,
      );
      const rows = r.data;
      setData(rows);
      setFiltered(rows);
      const uniqueLocations = Array.from(new Set(rows.map((e) => e.location))).sort();
      setLocations(uniqueLocations);
    } catch {
      setError("Failed to load access data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(!includeInactive);
  }, []);

  const handleInactiveToggle = (checked: boolean) => {
    setIncludeInactive(checked);
    fetchData(!checked);
  };

  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);
    if (location === null) {
      setFiltered(data);
    } else {
      setFiltered(data.filter((e) => e.location === location));
    }
  };

  if (loading) return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="border rounded-md">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 p-3 border-b last:border-0 items-center">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return <div className="text-center py-8 text-destructive">{error}</div>;

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={handleInactiveToggle}
          />
          <Label htmlFor="include-inactive">Include inactive employees</Label>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <ExportButtons
          data={filtered as unknown as Row[]}
          columns={columns as unknown as ColumnDef<Row>[]}
          filename="all-staff-access-report"
          title="All Staff Access Report"
          sortedData={sortedData as unknown as Row[]}
          isSorted={isSorted}
        />
        <p className="font-medium">Employee Count: {filtered.length}</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              {selectedLocation ? `Location: ${selectedLocation}` : "Filter Location"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="grid gap-2">
              <div className="font-medium">Filter by location</div>
              <ul className="max-h-60 overflow-auto">
                <li
                  className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                  onClick={() => filterByLocation(null)}
                >
                  <span>All Locations</span>
                  {selectedLocation === null && <Check className="h-4 w-4" />}
                </li>
                {locations.map((loc) => (
                  <li
                    key={loc}
                    className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                    onClick={() => filterByLocation(loc)}
                  >
                    <span>{loc}</span>
                    {selectedLocation === loc && <Check className="h-4 w-4" />}
                  </li>
                ))}
              </ul>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onSortedDataChange={(d, sorted) => {
          setSortedData(d as EmployeeAccessInfo[]);
          setIsSorted(sorted);
        }}
      />
    </div>
  );
}
