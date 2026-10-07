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
import {
  Department,
  EmployeeStatus,
  JobFamily,
  Location,
} from "@/generated/prisma_client/client";
import { Textarea } from "@/components/ui/textarea";
import { DateSelector } from "@/components/date-selector";
import { GenericCombobox, type ComboboxItem } from "@/components/ui/generic-combobox";
import { AxiosError } from "axios";

interface ManagerOption {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  title: string;
}

interface EmployeeEditFormProps {
  onSuccess?: () => void;
}

export function EmployeeEditForm({ onSuccess }: EmployeeEditFormProps) {
  const { employee, refreshData, employeeId } = useEmployee();
  const [isLoading, setIsLoading] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  // Form state
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [preferredFirstName, setPreferredFirstName] = useState("");
  const [preferredLastName, setPreferredLastName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [finishDate, setFinishDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [usi, setUsi] = useState("");
  const [status, setStatus] = useState<EmployeeStatus>("Permanent");
  const [isActive, setIsActive] = useState(true);
  const [jobFamilyId, setJobFamilyId] = useState("");
  const [reportsToId, setReportsToId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Options data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobFamilies, setJobFamilies] = useState<JobFamily[]>([]);
  const [managers, setManagers] = useState<ComboboxItem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Initialize form with employee data
  useEffect(() => {
    if (employee) {
      setLegalFirstName(employee.legalFirstName || "");
      setLegalLastName(employee.legalLastName || "");
      setPreferredFirstName(employee.preferredFirstName || "");
      setPreferredLastName(employee.preferredLastName || "");
      setTitle(employee.title || "");
      setDepartmentId(employee.departmentId?.toString() || "");
      setLocationId(employee.locationId?.toString() || "");
      setNotes(employee.notes || "");
      setUsi(employee.usi || "");
      setStatus(employee.status || "Permanent");
      setIsActive(employee.isActive ?? true);
      setStartDate(employee.startDate || new Date());
      setFinishDate(employee.finishDate || null);
      setJobFamilyId((employee as any).jobFamilyId?.toString() || "");
      setReportsToId(employee.reportsToId ?? null);
    }
  }, [employee]);

  // Fetch departments and locations
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [deptResponse, locResponse, jobFamiliesRes, employeesRes] = await Promise.all([
          api.get<Department[]>("/api/departments?activeOnly=true"),
          api.get<Location[]>("/api/locations?isActive=true"),
          api.get<JobFamily[]>("/api/job-families?activeOnly=true"),
          api.get<ManagerOption[]>("/api/employees?activeOnly=true"),
        ]);

        setDepartments(deptResponse.data);
        setLocations(locResponse.data);
        setJobFamilies(jobFamiliesRes.data);
        setManagers(
          employeesRes.data
            .map((e) => {
              const label = `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`;
              return { id: e.id, label, value: `${label} ${e.id}`, subtitle: e.title };
            })
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
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
    setError(null);

    const updateData = {
      legalFirstName,
      legalLastName,
      // Fall back to legal names when preferred is left blank
      preferredFirstName: preferredFirstName || legalFirstName,
      preferredLastName: preferredLastName || legalLastName,
      title,
      departmentId: departmentId ? parseInt(departmentId) : null,
      locationId: locationId ? parseInt(locationId) : null,
      startDate: startDate,
      finishDate: finishDate || null,
      notes,
      status,
      usi,
      isActive,
      jobFamilyId: jobFamilyId ? parseInt(jobFamilyId) : null,
      reportsToId,
    };

    try {
      await api.put(`/api/employees/${employeeId}`, updateData);

      // Refresh the employee data to get the latest info
      await refreshData();
      onSuccess?.();
    } catch (error) {
      console.error("Error updating employee:", error);
      setError(
        error instanceof AxiosError
          ? (error.response?.data?.error ?? "Failed to save the employee.")
          : "Failed to save the employee.",
      );
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
          <Label htmlFor="legalFirstName">Legal First Name</Label>
          <Input
            id="legalFirstName"
            name="legalFirstName"
            value={legalFirstName}
            onChange={(e) => setLegalFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalLastName">Legal Last Name</Label>
          <Input
            id="legalLastName"
            name="legalLastName"
            value={legalLastName}
            onChange={(e) => setLegalLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preferredFirstName">Preferred First Name</Label>
          <Input
            id="preferredFirstName"
            name="preferredFirstName"
            value={preferredFirstName}
            onChange={(e) => setPreferredFirstName(e.target.value)}
            placeholder="Defaults to legal first name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredLastName">Preferred Last Name</Label>
          <Input
            id="preferredLastName"
            name="preferredLastName"
            value={preferredLastName}
            onChange={(e) => setPreferredLastName(e.target.value)}
            placeholder="Defaults to legal last name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
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

      <div className="space-y-2">
        <Label htmlFor="usi">USI</Label>
        <Input
          id="usi"
          value={usi}
          onChange={(e) => setUsi(e.target.value)}
          placeholder="Unique Student Identifier"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Employment Status *</Label>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as EmployeeStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Permanent">Permanent</SelectItem>
            <SelectItem value="Apprentice">Apprentice</SelectItem>
            <SelectItem value="LabourContractor">LabourContractor</SelectItem>
            <SelectItem value="IndustryExperience">
              IndustryExperience
            </SelectItem>
            <SelectItem value="PartTimePermanent">PartTimePermanent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reportsTo">Reports To</Label>
        <GenericCombobox
          items={managers.filter((m) => m.id !== employee.id)}
          selectedItem={managers.find((m) => m.id === reportsToId) ?? null}
          onSelect={(item) => setReportsToId(item ? Number(item.id) : null)}
          placeholder={
            employee.reportsTo && employee.reportsTo.id === reportsToId
              ? `${employee.reportsTo.preferredFirstName || employee.reportsTo.legalFirstName} ${employee.reportsTo.preferredLastName || employee.reportsTo.legalLastName}`
              : "No manager"
          }
          searchPlaceholder="Search employees…"
          showSubtitle
          allowClear
          clearLabel="No manager"
          width="w-full"
          popoverWidth="w-[--radix-popover-trigger-width]"
        />
        <p className="text-xs text-muted-foreground">
          Kept up to date by the Workday import for internal staff. Set it here for external staff.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobFamily">Job Family</Label>
        <Select value={jobFamilyId} onValueChange={(v) => setJobFamilyId(v === "none" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select job family (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— None —</SelectItem>
            {jobFamilies.map((jf) => (
              <SelectItem key={jf.id} value={jf.id.toString()}>
                {jf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
      {/* Dialogs */}
      <AddDepartmentDialog
        open={isDepartmentDialogOpen}
        onOpenChange={setIsDepartmentDialogOpen}
        departments={departments}
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
