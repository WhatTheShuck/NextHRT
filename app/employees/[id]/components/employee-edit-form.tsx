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
import { format } from "date-fns";

export function EmployeeEditForm() {
  const { employee, setEmployee, employeeId } = useEmployee();
  const [isLoading, setIsLoading] = useState(false);

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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={employee.firstName}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={employee.lastName}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={employee.Title} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workAreaId">Work Area ID</Label>
        <Input
          id="workAreaId"
          name="workAreaId"
          type="number"
          defaultValue={employee.WorkAreaID}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          name="department"
          defaultValue={employee.Department}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={employee.Location}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={
              employee.StartDate
                ? format(new Date(employee.StartDate), "yyyy-MM-dd")
                : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="finishDate">Finish Date</Label>
          <Input
            id="finishDate"
            name="finishDate"
            type="date"
            defaultValue={
              employee.FinishDate
                ? format(new Date(employee.FinishDate), "yyyy-MM-dd")
                : ""
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="isActive">Status</Label>
        <Select name="isActive" defaultValue={employee.IsActive.toString()}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
