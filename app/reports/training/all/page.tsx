"use client";

import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Archive, Check } from "lucide-react";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import api from "@/lib/axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function CompletedTrainingPage() {
  const [filteredTrainingRecords, setFilteredTrainingRecords] = useState<
    TrainingRecordsWithRelations[]
  >([]);
  const [selectedTrainingTitle, setSelectedTrainingTitle] = useState<
    string | null
  >(null);
  const [trainingRecords, setTrainingRecords] = useState<
    TrainingRecordsWithRelations[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeLegacyTraining, setIncludeLegacyTraining] = useState(false);

  // Fetch training based on legacy and expired toggles
  const fetchTraining = async (includeLegacy: boolean = false) => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/training-records?activeOnly=${!includeLegacy}`,
      );
      setTrainingRecords(response.data);
      setFilteredTrainingRecords(response.data);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch training");
    } finally {
      setLoading(false);
    }
  };

  // Handle legacy training toggle
  const handleLegacyToggle = (checked: boolean) => {
    setIncludeLegacyTraining(checked);
    fetchTraining(checked);
    // Reset selection when switching training types
    setSelectedTrainingTitle(null);
  };

  // Initial effect to fetch training after component mounts
  useEffect(() => {
    fetchTraining(includeLegacyTraining);
  }, []);

  return (
    <>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">All Completed Training</h1>

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
                Include legacy training
              </Label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading Training Records...</div>
        ) : null}
        {error ? (
          <div className="text-center py-4 text-red-500">Error: {error}</div>
        ) : null}

        {!loading && !error && (
          <div className="container py-10 mx-auto">
            <div className="flex justify-between items-center mb-4">
              <p className="font-medium">
                Record Count: {filteredTrainingRecords.length}
              </p>
              <ExportButtons
                data={filteredTrainingRecords}
                columns={columns}
                filename={`${selectedTrainingTitle || "all-training"}-completions`}
                title={`${selectedTrainingTitle || "All Training"} - Completion Records`}
              />
            </div>
            <DataTable columns={columns} data={filteredTrainingRecords} />
          </div>
        )}
      </div>
    </>
  );
}
