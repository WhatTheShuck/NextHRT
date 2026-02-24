"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { EmployeeWithRelations } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";

export default function Page() {
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<
    EmployeeWithRelations[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [sortedData, setSortedData] = useState<EmployeeWithRelations[]>([]);
  const [isSorted, setIsSorted] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get<EmployeeWithRelations[]>(
          "/api/employees?reportType=evacuation",
        );
        const data = response.data;
        const activeEmployees = data.filter(
          (emp: EmployeeWithRelations) => emp.isActive,
        );
        setEmployees(activeEmployees);
        setFilteredEmployees(activeEmployees);
        // Extract unique locations
        const uniqueLocations = Array.from(
          new Set(
            activeEmployees.map(
              (emp: EmployeeWithRelations) => emp.location.name,
            ),
          ),
        ).filter(Boolean) as string[]; // Filter out null/undefined values

        setLocations(uniqueLocations);
      } catch (err) {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Filter employees by location
  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);

    if (location === null) {
      // Reset filter
      setFilteredEmployees(employees);
    } else {
      // Apply filter
      setFilteredEmployees(
        employees.filter((emp) => emp.location.name === location),
      );
    }
  };

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
          data={filteredEmployees}
          columns={columns}
          filename="active-employees"
          title="Active Employees Report"
          sortedData={sortedData}
          isSorted={isSorted}
        />
        <p className="font-medium">
          {" "}
          Employee Count: {filteredEmployees.length}{" "}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              {selectedLocation
                ? `Location: ${selectedLocation}`
                : "Filter Location"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="grid gap-2">
              <div className="font-medium">Filter by location</div>
              <ul className="max-h-60 overflow-auto">
                {/* Show All option */}
                <li
                  className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                  onClick={() => filterByLocation(null)}
                >
                  <span>All Locations</span>
                  {selectedLocation === null && <Check className="h-4 w-4" />}
                </li>

                {/* Location items */}
                {locations.map((location) => (
                  <li
                    key={location}
                    className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                    onClick={() => filterByLocation(location)}
                  >
                    <span>{location}</span>
                    {selectedLocation === location && (
                      <Check className="h-4 w-4" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </PopoverContent>
        </Popover>
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
  );
}
