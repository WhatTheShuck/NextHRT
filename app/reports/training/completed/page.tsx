"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Training } from "@/generated/prisma_client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import api from "@/lib/axios";
import { TrainingRecordsWithRelations } from "@/lib/types";

export default function CompletedTrainingPage() {
  const [trainingSelection, setTrainingSelection] = useState<Training[]>([]);
  const [filteredTrainingRecords, setFilteredTrainingRecords] = useState<
    TrainingRecordsWithRelations[]
  >([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | null>(
    null,
  );
  const [selectedTrainingTitle, setSelectedTrainingTitle] = useState<
    string | null
  >(null);
  const [trainingRecords, setTrainingRecords] = useState<
    TrainingRecordsWithRelations[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]);

  const fetchRecords = async (trainingID: number) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/training/${trainingID}`);
      const data = response.data;
      const records = data.trainingRecords || [];
      setTrainingRecords(records);
      setSelectedTrainingId(Number(trainingID));
      setFilteredTrainingRecords(records);
      // Extract unique locations
      const uniqueLocations = Array.from(
        new Set(
          records.map(
            (rec: TrainingRecordsWithRelations) =>
              rec.personTrained?.location.name,
          ),
        ),
      ).filter(Boolean) as string[]; // Filter out null/undefined values

      setLocations(uniqueLocations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const fetchTrainings = async () => {
      const response = await fetch("/api/training");
      const data = await response.json();
      setTrainingSelection(data);
    };
    fetchTrainings();
  }, []);

  // Filter records by location
  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);

    if (location === null) {
      // Reset filter
      setFilteredTrainingRecords(trainingRecords);
    } else {
      // Apply filter
      setFilteredTrainingRecords(
        trainingRecords.filter(
          (rec) => rec.personTrained?.location.name === location,
        ),
      );
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Training Completion Records</h1>

      <div className="flex items-center gap-4 mb-6">
        <Select
          onValueChange={(value) => {
            const selectedTraining = trainingSelection.find(
              (training) => training.id.toString() === value,
            );
            if (selectedTraining) {
              setSelectedTrainingTitle(selectedTraining.title);
            }
            fetchRecords(Number(value));
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a training type" />
          </SelectTrigger>
          <SelectContent>
            {trainingSelection.map((training) => (
              <SelectItem key={training.id} value={training.id.toString()}>
                {training.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading Training Records...</div>
      ) : null}
      {error ? (
        <div className="text-center py-4 text-red-500">Error: {error}</div>
      ) : null}

      {selectedTrainingId && !loading && !error && (
        <div className="container py-10 mx-auto">
          <div className="flex justify-between items-center mb-4">
            <ExportButtons
              data={filteredTrainingRecords}
              columns={columns}
              filename={`${selectedTrainingTitle}-completions`}
              title={`${selectedTrainingTitle} - Completion Records`}
            />
            <p className="font-medium">
              {" "}
              Record Count: {filteredTrainingRecords.length}{" "}
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
                      {selectedLocation === null && (
                        <Check className="h-4 w-4" />
                      )}
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
          <DataTable columns={columns} data={filteredTrainingRecords} />
        </div>
      )}
    </div>
  );
}
