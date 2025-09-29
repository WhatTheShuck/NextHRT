"use client";

import { useState } from "react";
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
import {
  GenericCombobox,
  ComboboxItem,
  createComboboxItem,
} from "@/components/ui/generic-combobox";

interface AddDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDepartmentAdded?: (department: Department) => void;
  departments: Department[];
}

interface DepartmentFormProps {
  departments: Department[];
  onDepartmentAdded?: (department: Department) => void;
  onClose: () => void;
  className?: string;
}

function DepartmentForm({
  departments,
  onDepartmentAdded,
  onClose,
  className,
}: DepartmentFormProps) {
  const [departmentName, setDepartmentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Filter to only show parent departments (departments that don't have a parent themselves)
  const parentDepartments = departments.filter(
    (dep) => dep.parentDepartmentId === null,
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

  const resetForm = () => {
    setDepartmentName("");
    setParentDepartmentId(null);
    setError(null);
  };

  const handleCreate = async () => {
    if (!departmentName.trim()) {
      setError("Please enter a department name");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await api.post<Department>("/api/departments", {
        name: departmentName,
        parentDepartmentId: parentDepartmentId
          ? parseInt(parentDepartmentId)
          : null,
      });

      onDepartmentAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating department:", err);

      if (err.response?.status === 409) {
        setError("A department with this name already exists");
      } else {
        setError(err.response?.data?.error || "Failed to create department");
      }
    } finally {
      setIsCreating(false);
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
          placeholder="e.g., Engineering"
          disabled={isCreating}
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
          disabled={isCreating}
        />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Department"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isCreating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AddDepartmentDialog({
  open,
  onOpenChange,
  onDepartmentAdded,
  departments,
}: AddDepartmentDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Create a new department that will be available for selection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DepartmentForm
              departments={departments}
              onDepartmentAdded={onDepartmentAdded}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Department</DrawerTitle>
          <DrawerDescription>
            Create a new department that will be available for selection.
          </DrawerDescription>
        </DrawerHeader>
        <DepartmentForm
          className="px-4"
          departments={departments}
          onDepartmentAdded={onDepartmentAdded}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
