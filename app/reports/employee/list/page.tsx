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
import { Check, MapPin } from "lucide-react";
import { EmployeeWithRelations } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { Skeleton } from "@/components/ui/skeleton";

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
        const uniqueLocations = Array.from(
          new Set(
            activeEmployees.map(
              (emp: EmployeeWithRelations) => emp.location.name,
            ),
          ),
        ).filter(Boolean) as string[];
        setLocations(uniqueLocations);
      } catch (err) {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);
    if (location === null) {
      setFilteredEmployees(employees);
    } else {
      setFilteredEmployees(
        employees.filter((emp) => emp.location.name === location),
      );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
        <Skeleton className="h-8 w-56 mb-6" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="border rounded-md">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-6 p-3 border-b last:border-0 items-center"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
        Active Employee List
      </h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <ExportButtons
          data={filteredEmployees}
          columns={columns}
          filename="active-employees"
          title="Active Employees Report"
          sortedData={sortedData}
          isSorted={isSorted}
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {filteredEmployees.length} employee
            {filteredEmployees.length !== 1 ? "s" : ""}
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <MapPin className="h-4 w-4 mr-2" />
                {selectedLocation ? selectedLocation : "All Locations"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <p className="text-sm font-medium px-2 py-1 text-muted-foreground">
                Filter by location
              </p>
              <ul>
                <li
                  className="flex items-center justify-between py-1.5 px-2 cursor-pointer hover:bg-accent rounded-md text-sm"
                  onClick={() => filterByLocation(null)}
                >
                  <span>All Locations</span>
                  {selectedLocation === null && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </li>
                {locations.map((location) => (
                  <li
                    key={location}
                    className="flex items-center justify-between py-1.5 px-2 cursor-pointer hover:bg-accent rounded-md text-sm"
                    onClick={() => filterByLocation(location)}
                  >
                    <span>{location}</span>
                    {selectedLocation === location && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
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
