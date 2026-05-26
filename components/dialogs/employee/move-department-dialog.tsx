"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
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
import {
  GenericCombobox,
  ComboboxItem,
  createComboboxItem,
} from "@/components/ui/generic-combobox";

interface FlatDepartment {
  id: number;
  name: string;
}

interface MoveDepartmentFormProps {
  employeeId: number;
  employeeName: string;
  currentDeptId: number;
  departments: FlatDepartment[];
  onMoved: () => void;
  onClose: () => void;
  className?: string;
}

function MoveDepartmentForm({
  employeeId,
  employeeName,
  currentDeptId,
  departments,
  onMoved,
  onClose,
  className,
}: MoveDepartmentFormProps) {
  const [selectedItem, setSelectedItem] = useState<ComboboxItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items: ComboboxItem[] = departments
    .filter((d) => d.id !== currentDeptId)
    .map((d) => createComboboxItem(d.id, d.name, d.name));

  const handleSave = async () => {
    if (!selectedItem) {
      setError("Please select a department.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/employees/${employeeId}`, {
        departmentId: Number(selectedItem.id),
      });
      onMoved();
      onClose();
    } catch {
      setError("Failed to move employee. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedItem(null);
    setError(null);
    onClose();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label>New Department</Label>
        <GenericCombobox
          items={items}
          selectedItem={selectedItem}
          onSelect={(item) => {
            setSelectedItem(item);
            if (error) setError(null);
          }}
          placeholder="Select a department..."
          searchPlaceholder="Search departments..."
          emptyMessage="No departments found."
          width="w-full"
          disabled={saving}
        />
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={handleSave} disabled={saving || !selectedItem}>
          {saving ? "Moving..." : "Move Employee"}
        </Button>
        <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface MoveDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  employeeName: string;
  currentDeptId: number;
  departments: FlatDepartment[];
  onMoved: () => void;
}

export function MoveDepartmentDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  currentDeptId,
  departments,
  onMoved,
}: MoveDepartmentDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  const formProps = {
    employeeId,
    employeeName,
    currentDeptId,
    departments,
    onMoved,
    onClose: handleClose,
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Employee</DialogTitle>
            <DialogDescription>
              Select a new department for {employeeName}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <MoveDepartmentForm {...formProps} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Move Employee</DrawerTitle>
          <DrawerDescription>
            Select a new department for {employeeName}.
          </DrawerDescription>
        </DrawerHeader>
        <MoveDepartmentForm {...formProps} className="px-4" />
      </DrawerContent>
    </Drawer>
  );
}
