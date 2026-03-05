"use client";

import React, { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/table-component";
import { ExportButtons } from "@/components/ExportButtons";

type Row = Record<string, unknown>;
import { LocationCombobox } from "@/components/combobox/location-combobox";
import { columns } from "./columns";
import { EmployeeAccessInfo } from "@/lib/services/accessCheckService";
import { Location } from "@/generated/prisma_client/client";
import api from "@/lib/axios";

export function LocationAccessReport() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [data, setData] = useState<EmployeeAccessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortedData, setSortedData] = useState<EmployeeAccessInfo[]>([]);
  const [isSorted, setIsSorted] = useState(false);
  const [fetchingLocations, setFetchingLocations] = useState(true);

  useEffect(() => {
    api
      .get<Location[]>("/api/locations")
      .then((r) => setLocations(r.data))
      .catch(() => setError("Failed to load locations"))
      .finally(() => setFetchingLocations(false));
  }, []);

  const handleSelect = async (locationId: string) => {
    const id = parseInt(locationId, 10);
    setSelectedLocationId(id);
    setData([]);
    setError(null);
    setLoading(true);
    try {
      const r = await api.get<EmployeeAccessInfo[]>(
        `/api/access-check/report?scope=location&id=${id}`,
      );
      setData(r.data);
    } catch {
      setError("Failed to load access data");
    } finally {
      setLoading(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  return (
    <>
      <div className="max-w-xl mb-6">
        <LocationCombobox
          locations={locations}
          onSelect={handleSelect}
          selectedLocationId={selectedLocationId}
          disabled={fetchingLocations}
          placeholder={fetchingLocations ? "Loading locations..." : "Search and select a location..."}
        />
      </div>

      {loading && <div className="text-center py-4">Loading access data...</div>}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">{error}</div>
      )}

      {selectedLocationId && !loading && !error && (
        <div className="container py-6 mx-auto">
          <div className="flex justify-between items-center mb-4">
            <ExportButtons
              data={data as unknown as Row[]}
              columns={columns as unknown as ColumnDef<Row>[]}
              filename={`${selectedLocation?.name ?? "location"}-access-report`}
              title={`${selectedLocation?.name ?? "Location"} Access Report`}
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
