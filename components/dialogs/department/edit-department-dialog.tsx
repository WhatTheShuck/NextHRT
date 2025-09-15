"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Department } from "@/generated/prisma_client";
import { Switch } from "@/components/ui/switch";
import {
  GenericCombobox,
  ComboboxItem,
  createComboboxItem,
} from "@/components/ui/generic-combobox";

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onDepartmentUpdated?: (department: Department) => void;
  departments: Department[];
}

interface DepartmentEditFormProps {
  department: Department | null;
  onDepartmentUpdated?: (department: Department) => void;
  onClose: () => void;
  className?: string;
  departments: Department[];
}

function DepartmentEditForm({
  department,
  onDepartmentUpdated,
  onClose,
  className,
  departments,
}: DepartmentEditFormProps) {
  const [departmentName, setDepartmentName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Filter to only show parent departments (departments that don't have a parent themselves)
  // Also exclude the current department being edited to prevent circular references
  const parentDepartments = departments.filter(
    (dep) => dep.parentDepartmentId === null && dep.id !== department?.id,
  );

  // Transform parent departments to ComboboxItem format
  const parentDepartmentItems: ComboboxItem[] = parentDepartments.map((dept) =>
    createComboboxItem(dept.id, dept.name, dept.name),
  );

  // Find the currently selected parent department
  const selectedParentDepartment =
    parentDepartmentItems.find(
      (item) => item.id.toString() === parentDepartmentId,
    ) || null;

  const handleParentDepartmentSelect = (item: ComboboxItem | null) => {
    setParentDepartmentId(item ? String(item.id) : null);
  };

  // Reset form when department changes
  useEffect(() => {
    if (department) {
      setDepartmentName(department.name || "");
      setIsActive(department.isActive ?? true);
      setParentDepartmentId(
        department.parentDepartmentId
          ? String(department.parentDepartmentId)
          : null,
      );
      setError(null);
    }
  }, [department]);

  const resetForm = () => {
    if (department) {
      setDepartmentName(department.name || "");
      setIsActive(department.isActive ?? true);
      setParentDepartmentId(
        department.parentDepartmentId
          ? String(department.parentDepartmentId)
          : null,
      );
    }
    setError(null);
  };

  const handleUpdate = async () => {
    if (!departmentName.trim()) {
      setError("Please enter a department name");
      return;
    }

    if (!department) {
      setError("No department selected");
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await api.put<Department>(
        `/api/departments/${department.id}`,
        {
          name: departmentName.trim(),
          isActive,
          parentDepartmentId: parentDepartmentId
            ? parseInt(parentDepartmentId)
            : null,
        },
      );

      onDepartmentUpdated?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error updating department:", err);

      if (err.response?.status === 409) {
        setError("A department with this name already exists");
      } else {
        setError(err.response?.data?.error || "Failed to update department");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="departmentName">Department Name</Label>
        <Input
          id="departmentName"
          value={departmentName}
          onChange={(e) => {
            setDepartmentName(e.target.value);
            if (error) setError(null); // Clear error when user starts typing
          }}
          placeholder="e.g., Engineering, Marketing, Sales"
          disabled={isUpdating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleUpdate();
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="parentDepartment">Parent Department (Optional)</Label>
        <GenericCombobox
          items={parentDepartmentItems}
          selectedItem={selectedParentDepartment}
          onSelect={handleParentDepartmentSelect}
          placeholder="Select a parent department..."
          searchPlaceholder="Search parent departments..."
          emptyMessage="No parent departments found."
          allowClear={true}
          clearLabel="No parent department"
          width="w-full"
          disabled={isUpdating}
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
          disabled={isUpdating}
        />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Department"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditDepartmentDialog({
  open,
  onOpenChange,
  department,
  onDepartmentUpdated,
  departments,
}: EditDepartmentDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
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
          <div className="py-4">
            <DepartmentEditForm
              department={department}
              onDepartmentUpdated={onDepartmentUpdated}
              onClose={handleClose}
              departments={departments}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Department</DrawerTitle>
          <DrawerDescription>
            Update the department name. This change will affect all employees
            assigned to this department.
          </DrawerDescription>
        </DrawerHeader>
        <DepartmentEditForm
          className="px-4"
          department={department}
          onDepartmentUpdated={onDepartmentUpdated}
          onClose={handleClose}
          departments={departments}
        />
      </DrawerContent>
    </Drawer>
  );
}
