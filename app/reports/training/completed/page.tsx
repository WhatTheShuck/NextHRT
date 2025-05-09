"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrainingRecords, type Training } from "@/generated/prisma_client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";

export default function CompletedTrainingPage() {
  const [trainingSelection, setTrainingSelection] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | null>(
    null,
  );
  const [trainingRecord, setTrainingRecord] = useState<TrainingRecords[]>([]);
  const fetchRecords = async (trainingID: number) => {
    const response = await fetch(`/api/training/${trainingID}`);
    if (!response.ok) {
      throw new Error("Failed to fetch training data");
    }

    const data = await response.json();

    setTrainingRecord(data.TrainingRecords);
    setSelectedTrainingId(Number(trainingID));
  };
  useEffect(() => {
    const fetchTrainings = async () => {
      const response = await fetch("/api/training");
      const data = await response.json();
      setTrainingSelection(data);
    };
    fetchTrainings();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Training Completion Records</h1>

      <div className="flex items-center gap-4 mb-6">
        <Select
          onValueChange={(value) => {
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

      {selectedTrainingId && (
        <div>
          <div>
            <ExportButtons
              data={trainingRecord}
              columns={columns}
              filename="completed-training"
              title="Completed Training Report"
              // Ideally use these as the values at some point
              // filename={`${trainingData.title}-completions`}
              // title={`${trainingData.title} - Completion Records`}
            />
          </div>
          <DataTable columns={columns} data={trainingRecord} />
        </div>
      )}
    </div>
  );
}
