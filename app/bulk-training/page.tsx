"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Employee, Training } from "@prisma/client";

const BulkTrainingForm = () => {
  // State for form data
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [openCalendar, setOpenCalendar] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]); // Changed to string[] for value consistency

  // State for API data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch employees and training courses on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [employeesRes, trainingsRes] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/training"),
        ]);

        if (!employeesRes.ok || !trainingsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const employeesData = await employeesRes.json();
        const trainingsData = await trainingsRes.json();

        setEmployees(employeesData);
        setTrainings(trainingsData);
      } catch (err) {
        setError("Failed to load data. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Create training records for each selected employee
      const promises = selectedEmployees.map((employeeId) =>
        fetch("/api/training-records", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeId: parseInt(employeeId),
            trainingId: parseInt(trainingId),
            dateCompleted: completionDate.toISOString(),
            trainer: provider,
          }),
        }),
      );

      await Promise.all(promises);

      // Reset form
      setTrainingId("");
      setProvider("");
      setCompletionDate(new Date());
      setSelectedEmployees([]);
    } catch (err) {
      setError("Failed to create training records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Bulk Training Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Training Selection */}
          <div className="space-y-2">
            <Label htmlFor="training">Training Course</Label>
            <Select value={trainingId} onValueChange={setTrainingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select training course" />
              </SelectTrigger>
              <SelectContent>
                {trainings.map((training) => (
                  <SelectItem key={training.id} value={training.id.toString()}>
                    {training.title} ({training.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Completion Date */}
          <div className="space-y-2">
            <Label>Completion Date</Label>
            <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {completionDate
                    ? format(completionDate, "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => {
                    if (date) {
                      setCompletionDate(date);
                      setOpenCalendar(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Employee Multi-Selection */}
          <div className="space-y-2">
            <Label>Employees</Label>
            <Select
              value={selectedEmployees.join(",")}
              onValueChange={(value) => {
                const employeeId = value.split(",").pop() || "";
                if (selectedEmployees.includes(employeeId)) {
                  setSelectedEmployees(
                    selectedEmployees.filter((id) => id !== employeeId),
                  );
                } else {
                  setSelectedEmployees([...selectedEmployees, employeeId]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employees">
                  {selectedEmployees.length > 0
                    ? `${selectedEmployees.length} employee(s) selected`
                    : "Select employees"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem
                    key={employee.id}
                    value={employee.id.toString()}
                    className={
                      selectedEmployees.includes(employee.id.toString())
                        ? "bg-accent"
                        : ""
                    }
                  >
                    {employee.firstName} {employee.lastName} - {employee.Title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading ||
              !trainingId ||
              !provider ||
              selectedEmployees.length === 0
            }
          >
            {isLoading ? "Creating Records..." : "Allocate Training"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BulkTrainingForm;
