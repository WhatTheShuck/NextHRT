// app/employees/[id]/components/employee-edit-form.tsx
"use client";

import { useEmployee } from "@/app/employees/[id]/components/employee-context";
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
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AddDepartmentDialog } from "@/components/dialogs/department/add-department-dialog";
import { AddLocationDialog } from "@/components/dialogs/location/add-location-dialog";
import api from "@/lib/axios";
import { Department, Location } from "@/generated/prisma_client";
import { Textarea } from "@/components/ui/textarea";
import { DateSelector } from "@/components/date-selector";

interface EmployeeEditFormProps {
  onSuccess?: () => void;
}

export function EmployeeEditForm({ onSuccess }: EmployeeEditFormProps) {
  const { employee, refreshData, employeeId } = useEmployee();
  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [job, setJob] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [finishDate, setFinishDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [usi, setUsi] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Options data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Initialize form with employee data
  useEffect(() => {
    if (employee) {
      setFirstName(employee.firstName || "");
      setLastName(employee.lastName || "");
      setTitle(employee.title || "");
      setDepartmentId(employee.departmentId?.toString() || "");
      setLocationId(employee.locationId?.toString() || "");
      setBusinessArea(employee.businessArea || "");
      setJob(employee.job || "");
      setNotes(employee.notes || "");
      setUsi(employee.usi || "");
      setIsActive(employee.isActive ?? true);
      setStartDate(employee.startDate || new Date());
      setFinishDate(employee.finishDate || null);
    }
  }, [employee]);

  // Fetch departments and locations
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [deptResponse, locResponse] = await Promise.all([
          api.get<Department[]>("/api/departments"),
          api.get<Location[]>("/api/locations"),
        ]);

        setDepartments(deptResponse.data);
        setLocations(locResponse.data);
      } catch (error) {
        console.error("Error fetching options:", error);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const updateData = {
      firstName,
      lastName,
      title,
      departmentId: departmentId ? parseInt(departmentId) : null,
      locationId: locationId ? parseInt(locationId) : null,
      businessArea,
      job,
      startDate: startDate,
      finishDate: finishDate || null,
      notes,
      usi,
      isActive,
    };

    try {
      await api.put(`/api/employees/${employeeId}`, updateData);

      // Refresh the employee data to get the latest info
      await refreshData();
      onSuccess?.();
    } catch (error) {
      console.error("Error updating employee:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingOptions) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading form...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={lastName}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={title} required />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
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
          <Label htmlFor="location">Location</Label>
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
          <Label htmlFor="businessArea">Business Area</Label>
          <Input
            id="businessArea"
            value={businessArea}
            onChange={(e) => setBusinessArea(e.target.value)}
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
        <Label htmlFor="usi">USI</Label>
        <Input
          id="usi"
          value={usi}
          onChange={(e) => setUsi(e.target.value)}
          placeholder="Unique Student Identifier"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <DateSelector selectedDate={startDate} onDateSelect={setStartDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="finishDate">Finish Date</Label>
          <DateSelector
            selectedDate={finishDate}
            onDateSelect={setFinishDate}
            optional={true}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="isActive">Status</Label>
        <Select
          value={isActive.toString()}
          onValueChange={(value) => setIsActive(value === "true")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about the employee..."
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
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
    </form>
  );
}
