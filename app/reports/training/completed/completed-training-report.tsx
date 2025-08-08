"use client";

import React, { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Users, Archive } from "lucide-react";
import { Training } from "@/generated/prisma_client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import { TrainingCombobox } from "../../../../components/combobox/training-combobox";
import api from "@/lib/axios";
import { TrainingRecordsWithRelations } from "@/lib/types";

export function CompletedTrainingClient() {
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

  // New state for toggles
  const [includeInactiveEmployees, setIncludeInactiveEmployees] =
    useState(false);
  const [includeLegacyTraining, setIncludeLegacyTraining] = useState(false);
  const [fetchingTrainings, setFetchingTrainings] = useState(false);

  // Fetch trainings based on legacy toggle
  const fetchTrainings = async (includeLegacy: boolean = false) => {
    setFetchingTrainings(true);
    try {
      const response = await api.get(
        `/api/training?activeOnly=${!includeLegacy}`,
      );
      setTrainingSelection(response.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch trainings",
      );
    } finally {
      setFetchingTrainings(false);
    }
  };

  // Fetch training records with employee filter
  const fetchRecords = async (
    trainingID: number,
    includeInactive: boolean = false,
  ) => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/training/${trainingID}?activeOnly=${!includeInactive}`,
      );
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
      ).filter(Boolean) as string[];

      setLocations(uniqueLocations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle training selection
  const handleTrainingSelect = (trainingId: string) => {
    const selectedTraining = trainingSelection.find(
      (training) => training.id.toString() === trainingId,
    );
    if (selectedTraining) {
      setSelectedTrainingTitle(selectedTraining.title);
      fetchRecords(Number(trainingId), includeInactiveEmployees);
    }
  };

  // Handle legacy training toggle
  const handleLegacyToggle = (checked: boolean) => {
    setIncludeLegacyTraining(checked);
    fetchTrainings(checked);
    // Reset selection when switching training types
    setSelectedTrainingId(null);
    setSelectedTrainingTitle(null);
    setTrainingRecords([]);
    setFilteredTrainingRecords([]);
  };

  // Handle inactive employees toggle
  const handleInactiveEmployeesToggle = (checked: boolean) => {
    setIncludeInactiveEmployees(checked);
    // Re-fetch records if a training is selected
    if (selectedTrainingId) {
      fetchRecords(selectedTrainingId, checked);
    }
  };

  // Filter records by location
  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);

    if (location === null) {
      setFilteredTrainingRecords(trainingRecords);
    } else {
      setFilteredTrainingRecords(
        trainingRecords.filter(
          (rec) => rec.personTrained?.location.name === location,
        ),
      );
    }
  };

  // Initial effect to fetch trainings after component mounts (session ready)
  useEffect(() => {
    fetchTrainings();
  }, []);

  return (
    <>
      {/* Configuration toggles */}
      <div className="p-4 rounded-lg mb-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-2">
            <Switch
              id="legacy-training"
              checked={includeLegacyTraining}
              onCheckedChange={handleLegacyToggle}
            />
            <Label
              htmlFor="legacy-training"
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Include legacy training courses
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="inactive-employees"
              checked={includeInactiveEmployees}
              onCheckedChange={handleInactiveEmployeesToggle}
            />
            <Label
              htmlFor="inactive-employees"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Include inactive employees
            </Label>
          </div>
        </div>
      </div>

      {/* Training selection */}
      <div className="flex items-center gap-4 mb-6">
        <TrainingCombobox
          trainings={trainingSelection}
          onSelect={handleTrainingSelect}
          selectedTrainingId={selectedTrainingId}
          disabled={fetchingTrainings}
          placeholder={
            fetchingTrainings
              ? "Loading trainings..."
              : "Search and select a training course..."
          }
        />
      </div>

      {/* Loading and error states */}
      {loading && (
        <div className="text-center py-4">Loading Training Records...</div>
      )}

      {error && (
        <div className="text-center py-4 text-destructive bg-destructive/10 rounded-lg p-4">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Data table and filters */}
      {selectedTrainingId && !loading && !error && (
        <div className="container py-10 mx-auto">
          <div className="flex justify-between items-center mb-4">
            <ExportButtons
              data={filteredTrainingRecords}
              columns={columns}
              filename={`${selectedTrainingTitle}-completions`}
              title={`${selectedTrainingTitle} - Completion Records`}
            />

            <div className="flex items-center gap-4">
              <p className="font-medium text-sm text-muted-foreground">
                Record Count: {filteredTrainingRecords.length}
              </p>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
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
                        className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-accent rounded"
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
                          className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-accent rounded"
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
          </div>

          <DataTable columns={columns} data={filteredTrainingRecords} />
        </div>
      )}
    </>
  );
}
