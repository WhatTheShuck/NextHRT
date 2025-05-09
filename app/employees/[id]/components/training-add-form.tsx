"use client";

import { useEmployee } from "./employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Training } from "@prisma/client";
import { TrainingSelector } from "@/app/bulk-training/components/training-selector";
import { DateSelector } from "@/app/bulk-training/components/date-selector";
import api from "@/lib/axios";

export function TrainingAddForm() {
  const { employee } = useEmployee();
  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());

  // Data fetching state
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: trainingsRes } = await api.get("/api/training");
        setTrainings(trainingsRes);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);
  const addTraining = (newTraining: Training) => {
    setTrainings([...trainings, newTraining]);
    setTrainingId(newTraining.id.toString());
  };
  if (!employee) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/training-records`, {
        employeeId: employee.id,
        trainingId: parseInt(trainingId),
        dateCompleted: completionDate.toISOString(),
        trainer: provider,
      });
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-2">
        <TrainingSelector
          trainings={trainings}
          selectedTrainingId={trainingId}
          onTrainingSelect={setTrainingId}
          onNewTraining={addTraining}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Training Provider</Label>
        <Input
          id="provider"
          placeholder="Enter provider name"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <DateSelector
          selectedDate={completionDate}
          onDateSelect={setCompletionDate}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting || !trainingId || !provider}
      >
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
