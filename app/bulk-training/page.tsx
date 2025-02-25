"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Employee, Training } from "@prisma/client";
import { TrainingSelector } from "./components/training-selector";
import { EmployeeSelector } from "./components/employee-selector";
import { DateSelector } from "./components/date-selector";
import { AlertBox } from "@/components/ui/alert-box";
import api from "@/lib/axios";

export default function BulkTrainingPage() {
  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);

  // Data fetching state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [employeesRes, trainingsRes] = await Promise.all([
          api.get("/api/employees"),
          api.get("/api/training"),
        ]);

        setEmployees(employeesRes.data);
        setTrainings(trainingsRes.data);
      } catch (err) {
        console.error("API error:", err);
        setError("Failed to load data. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add a new training to the list
  const addTraining = (newTraining: Training) => {
    setTrainings([...trainings, newTraining]);
    setTrainingId(newTraining.id.toString());
  };

  // Handle bulk training submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous messages
    setError("");
    setSuccess("");

    if (selectedEmployees.length === 0) {
      setError("Please select at least one employee");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Create training records for each selected employee
      const promises = selectedEmployees.map((employee) =>
        api.post("/api/training-records", {
          employeeId: employee.id,
          trainingId: parseInt(trainingId),
          dateCompleted: completionDate.toISOString(),
          trainer: provider,
        }),
      );

      await Promise.all(promises);

      // Show success message
      setSuccess(
        `Successfully allocated training to ${selectedEmployees.length} employee(s)`,
      );

      // Reset form
      setTrainingId("");
      setProvider("");
      setCompletionDate(new Date());
      setSelectedEmployees([]);
    } catch (err) {
      setError("Failed to create training records. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading && employees.length === 0 && trainings.length === 0) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Bulk Training Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <AlertBox type="error" message={error} />}
        {success && <AlertBox type="success" message={success} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Training Selector Component */}
          <TrainingSelector
            trainings={trainings}
            selectedTrainingId={trainingId}
            onTrainingSelect={setTrainingId}
            onNewTraining={addTraining}
          />

          {/* Training Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Training Provider</Label>
            <Input
              id="provider"
              placeholder="Enter provider name"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>

          {/* Date Selector Component */}
          <DateSelector
            selectedDate={completionDate}
            onDateSelect={setCompletionDate}
          />

          {/* Employee Selector Component */}
          <EmployeeSelector
            employees={employees}
            selectedEmployees={selectedEmployees}
            onSelectionChange={setSelectedEmployees}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !trainingId ||
              !provider ||
              selectedEmployees.length === 0
            }
          >
            {isSubmitting
              ? "Creating Records..."
              : `Allocate Training to ${selectedEmployees.length} Employee(s)`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
