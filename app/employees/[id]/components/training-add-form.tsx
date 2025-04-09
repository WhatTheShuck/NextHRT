// app/employees/[id]/components/employee-edit-form.tsx
"use client";

import { useEmployee } from "./employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Training, Employee } from "@prisma/client";
import { TrainingSelector } from "@/app/bulk-training/components/training-selector";
import { DateSelector } from "@/app/bulk-training/components/date-selector";

export function TrainingAddForm() {
  const { employee, setEmployee, employeeId } = useEmployee();
  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);

  // Data fetching state
  // const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const addTraining = (newTraining: Training) => {
    setTrainings([...trainings, newTraining]);
    setTrainingId(newTraining.id.toString());
  };
  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      WorkAreaID: parseInt(formData.get("workAreaId") as string),
      Title: formData.get("title"),
      Department: formData.get("department"),
      Location: formData.get("location"),
      StartDate: formData.get("startDate"),
      FinishDate: formData.get("finishDate") || null,
      IsActive: formData.get("isActive") === "true",
    };

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update employee");

      const updatedEmployee = await response.json();
      setEmployee(updatedEmployee);
    } catch (error) {
      console.error("Error updating employee:", error);
    } finally {
      setIsLoading(false);
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

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
