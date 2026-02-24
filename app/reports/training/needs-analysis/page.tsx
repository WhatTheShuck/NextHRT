"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useMemo, useState } from "react";
import { Archive, BadgeCheck } from "lucide-react";
import { EmployeeWithRequirementStatus } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrainingCombobox } from "@/components/combobox/training-combobox";
import { Training } from "@/generated/prisma_client";

export default function Page() {
  const [allEmployees, setAllEmployees] = useState<
    EmployeeWithRequirementStatus[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeCompletedRecords, setIncludeCompletedRecords] = useState(false);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(
    null,
  );
  const [selectedTrainingName, setSelectedTrainingName] = useState<string>("");
  const [sortedData, setSortedData] = useState<EmployeeWithRequirementStatus[]>(
    [],
  );
  const [isSorted, setIsSorted] = useState(false);

  useEffect(() => {
    const fetchTraining = async () => {
      try {
        const response = await api.get<Training[]>("/api/training");
        setTrainings(response.data);
      } catch (error) {
        console.error("Error fetching trainings:", error);
        setError("Error fetching trainings");
      } finally {
        setLoading(false);
      }
    };
    fetchTraining();
  }, []);

  const fetchEmployees = async (trainingId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/api/requirements?trainingId=${trainingId}`,
      );

      setAllEmployees(response.data.employees);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setError(
          "No requirements found for this training. Please select a different training or contact your administrator.",
        );
      } else {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompletedRecordsToggle = (checked: boolean) => {
    setIncludeCompletedRecords(checked);
  };

  // Handle training selection
  const handleTrainingSelect = (trainingId: string) => {
    setSelectedTrainingId(trainingId);
    const training = trainings.find((t) => t.id.toString() === trainingId);
    setSelectedTrainingName(training?.title || "");
    fetchEmployees(trainingId);
  };

  // Filter employees based on completed records toggle
  const displayedEmployees = useMemo(() => {
    if (includeCompletedRecords) {
      return allEmployees;
    } else {
      return allEmployees.filter((emp) => emp.requirementStatus === "Required");
    }
  }, [allEmployees, includeCompletedRecords]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        Individual Training Needs Analysis Report
      </h1>

      {/* Configuration toggles */}
      <div className="p-4 rounded-lg mb-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-2">
            <Switch
              id="completed-records"
              checked={includeCompletedRecords}
              onCheckedChange={handleCompletedRecordsToggle}
            />
            <Label
              htmlFor="completed-records"
              className="flex items-center gap-2"
            >
              <BadgeCheck className="h-4 w-4" />
              Include completed records
            </Label>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <TrainingCombobox
          trainings={trainings}
          selectedTrainingId={selectedTrainingId}
          onSelect={handleTrainingSelect}
        />
      </div>

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
      {selectedTrainingId && !loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {displayedEmployees.length} employee(s)
            </div>
            <ExportButtons
              data={displayedEmployees}
              columns={columns}
              filename={`training-requirements-${selectedTrainingName.toLowerCase().replace(/\s+/g, "-")}`}
              title={`Training Requirements Report - ${selectedTrainingName}`}
              sortedData={sortedData}
              isSorted={isSorted}
            />
          </div>
          <DataTable
            columns={columns}
            data={displayedEmployees}
            onSortedDataChange={(data, sorted) => {
              setSortedData(data);
              setIsSorted(sorted);
            }}
          />
        </div>
      )}
    </div>
  );
}
