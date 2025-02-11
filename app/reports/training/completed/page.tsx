// app/completed/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import TrainingCompletionTable from "@/components/TrainingCompletionTable";
import type { Training } from "@prisma/client";

export default function CompletedTrainingPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const fetchTrainings = async () => {
      const response = await fetch("/api/training");
      const data = await response.json();
      setTrainings(data);
    };
    fetchTrainings();
  }, []);

  const handleOpenInNewTab = () => {
    if (selectedTrainingId) {
      window.open(
        `/reports/training/completed/${selectedTrainingId}`,
        "_blank",
      );
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Training Completion Records</h1>

      <div className="flex items-center gap-4 mb-6">
        <Select onValueChange={(value) => setSelectedTrainingId(Number(value))}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a training type" />
          </SelectTrigger>
          <SelectContent>
            {trainings.map((training) => (
              <SelectItem key={training.id} value={training.id.toString()}>
                {training.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTrainingId && (
        <TrainingCompletionTable trainingId={selectedTrainingId} />
      )}
    </div>
  );
}
