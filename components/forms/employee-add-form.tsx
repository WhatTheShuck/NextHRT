"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Department, Location } from "@/generated/prisma_client";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddDepartmentDialog } from "@/components/dialogs/department/add-department-dialog";
import { AddLocationDialog } from "@/components/dialogs/location/add-location-dialog";
import { AxiosError } from "axios";
import { EmployeeFormData, EmployeeWithRelations } from "@/lib/types";
import { DuplicateEmployeeDialog } from "@/components/dialogs/duplicate-employee-dialog";
import { DateSelector } from "@/components/date-selector";

interface EmployeeAddFormProps {
  onSuccess?: () => void;
}
interface DuplicateResponse {
  error: string;
  code: string;
  matches: Array<EmployeeWithRelations>;
  suggestions: {
    rehire: boolean;
    duplicate: boolean;
  };
}
export function EmployeeAddForm({ onSuccess }: EmployeeAddFormProps) {
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [job, setJob] = useState("");
  const [notes, setNotes] = useState("");
  const [usi, setUsi] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date());

  // Data state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  // Duplicate handling state
  const [duplicateData, setDuplicateData] = useState<DuplicateResponse | null>(
    null,
  );
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [departmentsRes, locationsRes] = await Promise.all([
          api.get<Department[]>("/api/departments"),
          api.get<Location[]>("/api/locations"),
        ]);
        setDepartments(departmentsRes.data);
        setLocations(locationsRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);
  const createEmployeeData = (): EmployeeFormData => ({
    firstName,
    lastName,
    title,
    departmentId: parseInt(departmentId),
    locationId: parseInt(locationId),
    businessArea,
    job,
    notes: notes || null,
    usi: usi || null,
    isActive,
    startDate: startDate?.toISOString() || null,
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !firstName ||
      !lastName ||
      !title ||
      !departmentId ||
      !locationId ||
      !businessArea ||
      !job
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/employees", {
        firstName,
        lastName,
        title,
        departmentId: parseInt(departmentId),
        locationId: parseInt(locationId),
        businessArea,
        job,
        notes: notes || null,
        usi: usi || null,
        isActive,
        startDate: startDate?.toISOString() || null,
      });

      onSuccess?.();
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        // Handle duplicate employee case
        const duplicateResponse = err.response.data as DuplicateResponse;
        setDuplicateData(duplicateResponse);
        setIsDuplicateDialogOpen(true);
      } else {
        alert("Failed to create employee. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDuplicateSuccess = () => {
    // Reset form and close dialog
    setIsDuplicateDialogOpen(false);
    setDuplicateData(null);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <div className="flex gap-2">
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setIsDepartmentDialogOpen(true)}
              title="Add new department"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <div className="flex gap-2">
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}, {loc.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setIsLocationDialogOpen(true)}
              title="Add new location"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessArea">Business Area *</Label>
          <Input
            id="businessArea"
            value={businessArea}
            onChange={(e) => setBusinessArea(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="job">Job *</Label>
          <Input
            id="job"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Start Date</Label>
        <DateSelector selectedDate={startDate} onDateSelect={setStartDate} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="usi">USI (Universal Student Identifier)</Label>
        <Input
          id="usi"
          value={usi}
          onChange={(e) => setUsi(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about the employee"
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active Employee
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create Employee"}
      </Button>

      {/* Dialogs */}
      <AddDepartmentDialog
        open={isDepartmentDialogOpen}
        onOpenChange={setIsDepartmentDialogOpen}
        onDepartmentAdded={(dept) => {
          setDepartments([...departments, dept]);
          setDepartmentId(dept.id.toString());
        }}
      />

      <AddLocationDialog
        open={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
        onLocationAdded={(loc) => {
          setLocations([...locations, loc]);
          setLocationId(loc.id.toString());
        }}
      />
      {/* Duplicate Employee Dialog */}
      {duplicateData && (
        <DuplicateEmployeeDialog
          open={isDuplicateDialogOpen}
          onOpenChange={setIsDuplicateDialogOpen}
          duplicateData={duplicateData}
          employeeFormData={createEmployeeData()}
          onSuccess={handleDuplicateSuccess}
        />
      )}
    </form>
  );
}
