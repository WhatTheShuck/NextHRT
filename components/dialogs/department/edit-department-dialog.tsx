"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Department } from "@/generated/prisma_client";
import { Switch } from "@/components/ui/switch";

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onDepartmentUpdated?: (department: Department) => void;
}

export function EditDepartmentDialog({
  open,
  onOpenChange,
  department,
  onDepartmentUpdated,
}: EditDepartmentDialogProps) {
  const [departmentName, setDepartmentName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Reset form when dialog opens/closes or department changes
  useEffect(() => {
    if (open && department) {
      setDepartmentName(department.name || "");
      setIsActive(department.isActive ?? true);
    } else if (!open) {
      setDepartmentName("");
      setIsActive(true);
    }
  }, [open, department]);

  const handleUpdate = async () => {
    if (!departmentName.trim()) {
      alert("Please enter a department name");
      return;
    }

    if (!department) {
      alert("No department selected");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await api.put<Department>(
        `/api/departments/${department.id}`,
        {
          name: departmentName.trim(),
          isActive,
        },
      );

      onDepartmentUpdated?.(response.data);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error updating department:", err);
      alert(err.response?.data?.error || "Failed to update department");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>
            Update the department name. This change will affect all employees
            assigned to this department.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="departmentName">Department Name</Label>
            <Input
              id="departmentName"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g., Engineering, Marketing, Sales"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUpdate();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between space-x-2 py-2">
            <div className="space-y-1">
              <Label htmlFor="isActive" className="text-sm font-medium">
                Department Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable this Department
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
