"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Employee, Training } from "@/generated/prisma_client";
import { EmployeeSelector } from "./components/employee-selector";
import { AlertBox } from "@/components/ui/alert-box";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { TrainingCombobox } from "@/components/combobox/training-combobox";

export default function BulkTrainingPage() {
  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
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
      setSelectedEmployees([]);
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        // Access Axios-specific error properties
        setError(
          err.response?.data?.message || err.message || "API error occurred",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create training. Please try again.");
      }
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
          <TrainingCombobox
            trainings={trainings}
            selectedTrainingId={trainingId}
            onSelect={setTrainingId}
            showAddButton={true}
            label="Training Course"
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
