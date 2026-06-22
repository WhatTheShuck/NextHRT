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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Department, UserRole } from "@/generated/prisma_client/client";
import {
  GenericCombobox,
  ComboboxItem,
  createComboboxItem,
} from "@/components/ui/generic-combobox";

export interface PendingDepartment {
  id: string; // "pending-{orgRequestId}"
  orgRequestId: number;
  name: string;
  parentDepartmentId: number | null;
  isPending: true;
}

interface AddDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDepartmentAdded?: (department: Department) => void;
  onDepartmentRequested?: (pending: PendingDepartment) => void;
  departments: Department[];
  userRole?: UserRole | null;
}

interface DepartmentFormProps {
  departments: Department[];
  onDepartmentAdded?: (department: Department) => void;
  onDepartmentRequested?: (pending: PendingDepartment) => void;
  onClose: () => void;
  isRequestMode: boolean;
  className?: string;
}

function DepartmentForm({
  departments,
  onDepartmentAdded,
  onDepartmentRequested,
  onClose,
  isRequestMode,
  className,
}: DepartmentFormProps) {
  const [departmentName, setDepartmentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parentDepartments = departments.filter((dep) => dep.parentDepartmentId === null);
  const parentDepartmentItems: ComboboxItem[] = parentDepartments.map((dept) =>
    createComboboxItem(dept.id, dept.name, dept.name),
  );
  const selectedParentDepartment =
    parentDepartmentItems.find((item) => item.id.toString() === parentDepartmentId) || null;

  const resetForm = () => {
    setDepartmentName("");
    setParentDepartmentId(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!departmentName.trim()) {
      setError("Please enter a department name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const parsedParentId = parentDepartmentId ? parseInt(parentDepartmentId) : null;

    if (isRequestMode) {
      try {
        const response = await api.post<{ id: number }>("/api/org-requests", {
          type: "Department",
          requestedData: { name: departmentName.trim(), parentDepartmentId: parsedParentId },
        });
        onDepartmentRequested?.({
          id: `pending-${response.data.id}`,
          orgRequestId: response.data.id,
          name: departmentName.trim(),
          parentDepartmentId: parsedParentId,
          isPending: true,
        });
        onClose();
        resetForm();
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to submit request");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        const response = await api.post<Department>("/api/departments", {
          name: departmentName.trim(),
          parentDepartmentId: parsedParentId,
        });
        onDepartmentAdded?.(response.data);
        onClose();
        resetForm();
      } catch (err: any) {
        if (err.response?.status === 409) {
          setError("A department with this name already exists");
        } else {
          setError(err.response?.data?.error || "Failed to create department");
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {isRequestMode && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
          This department doesn't exist yet. Submitting a request will notify an admin who can approve it. You can continue filling out the form in the meantime.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="departmentName">Department Name</Label>
        <Input
          id="departmentName"
          value={departmentName}
          onChange={(e) => {
            setDepartmentName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g., Engineering"
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="parentDepartment">Parent Department (Optional)</Label>
        <GenericCombobox
          items={parentDepartmentItems}
          selectedItem={selectedParentDepartment}
          onSelect={(item) => setParentDepartmentId(item ? String(item.id) : null)}
          placeholder="Select a parent department..."
          searchPlaceholder="Search parent departments..."
          emptyMessage="No parent departments found."
          allowClear={true}
          clearLabel="No parent department"
          width="w-full"
          disabled={isSubmitting}
        />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? isRequestMode ? "Submitting..." : "Creating..."
            : isRequestMode ? "Submit Request" : "Create Department"}
        </Button>
        <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
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
  onDepartmentRequested,
  departments,
  userRole,
}: AddDepartmentDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isRequestMode = userRole !== "Admin";

  const title = isRequestMode ? "Request New Department" : "Add New Department";
  const description = isRequestMode
    ? "Request a new department for admin approval."
    : "Create a new department that will be available for selection.";

  const handleClose = () => onOpenChange(false);

  const form = (className?: string) => (
    <DepartmentForm
      departments={departments}
      onDepartmentAdded={onDepartmentAdded}
      onDepartmentRequested={onDepartmentRequested}
      onClose={handleClose}
      isRequestMode={isRequestMode}
      className={className}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">{form()}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {form("px-4")}
      </DrawerContent>
    </Drawer>
  );
}
