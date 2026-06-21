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
import { JobFamily } from "@/generated/prisma_client/client";

interface AddJobFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobFamilyAdded?: (jobFamily: JobFamily) => void;
}

interface JobFamilyFormProps {
  onJobFamilyAdded?: (jobFamily: JobFamily) => void;
  onClose: () => void;
  className?: string;
}

function JobFamilyForm({ onJobFamilyAdded, onClose, className }: JobFamilyFormProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => setName("");

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Please enter a job family name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post<JobFamily>("/api/job-families", { name: name.trim() });
      onJobFamilyAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating job family:", err);
      alert(err.response?.data?.message || err.response?.data?.error || "Failed to create job family");
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
        <Label htmlFor="jobFamilyName">Job Family Name</Label>
        <Input
          id="jobFamilyName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Service Technician"
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
          {isCreating ? "Creating..." : "Create Job Family"}
        </Button>
        <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AddJobFamilyDialog({
  open,
  onOpenChange,
  onJobFamilyAdded,
}: AddJobFamilyDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Job Family</DialogTitle>
            <DialogDescription>
              Create a new job family that can be assigned to employees and used to drive onboarding prefills.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <JobFamilyForm onJobFamilyAdded={onJobFamilyAdded} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Job Family</DrawerTitle>
          <DrawerDescription>
            Create a new job family that can be assigned to employees and used to drive onboarding prefills.
          </DrawerDescription>
        </DrawerHeader>
        <JobFamilyForm className="px-4" onJobFamilyAdded={onJobFamilyAdded} onClose={handleClose} />
      </DrawerContent>
    </Drawer>
  );
}
