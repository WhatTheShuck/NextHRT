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
import { MedicalStandard } from "@/generated/prisma_client/client";

interface AddMedicalStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMedicalStandardAdded?: (medicalStandard: MedicalStandard) => void;
}

interface MedicalStandardFormProps {
  onMedicalStandardAdded?: (medicalStandard: MedicalStandard) => void;
  onClose: () => void;
  className?: string;
}

function MedicalStandardForm({
  onMedicalStandardAdded,
  onClose,
  className,
}: MedicalStandardFormProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setName("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Please enter a medical standard name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post<MedicalStandard>("/api/medical-standards", {
        name: name.trim(),
      });

      onMedicalStandardAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating medical standard:", err);
      alert(err.response?.data?.error || "Failed to create medical standard");
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
        <Label htmlFor="medicalStandardName">Medical Standard Name</Label>
        <Input
          id="medicalStandardName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., KSB Standard"
          disabled={isCreating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Medical Standard"}
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

export function AddMedicalStandardDialog({
  open,
  onOpenChange,
  onMedicalStandardAdded,
}: AddMedicalStandardDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Medical Standard</DialogTitle>
            <DialogDescription>
              Create a new medical standard that will be available for selection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <MedicalStandardForm
              onMedicalStandardAdded={onMedicalStandardAdded}
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
          <DrawerTitle>Add New Medical Standard</DrawerTitle>
          <DrawerDescription>
            Create a new medical standard that will be available for selection.
          </DrawerDescription>
        </DrawerHeader>
        <MedicalStandardForm
          className="px-4"
          onMedicalStandardAdded={onMedicalStandardAdded}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
