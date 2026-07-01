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
import { AlertTriangle } from "lucide-react";
import { JobFamily } from "@/generated/prisma_client/client";

interface JobFamilyWithCount extends JobFamily {
  _count?: { employees: number };
}

interface DeleteJobFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobFamily: JobFamilyWithCount | null;
  onJobFamilyDeleted?: (jobFamily: JobFamilyWithCount) => void;
}

interface DeleteFormProps {
  jobFamily: JobFamilyWithCount | null;
  onJobFamilyDeleted?: (jobFamily: JobFamilyWithCount) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({ jobFamily, onJobFamilyDeleted, onClose, className }: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!jobFamily) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/job-families/${jobFamily.id}`);
      onJobFamilyDeleted?.(jobFamily);
      onClose();
    } catch (err: any) {
      console.error("Error deleting job family:", err);
      alert(err.response?.data?.error || "Failed to delete job family");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning</p>
            <p className="text-sm text-muted-foreground">
              Deleting this job family will remove it from your system permanently.
              It cannot be deleted if employees are currently assigned to it.
            </p>
          </div>
        </div>
      </div>
      {jobFamily && (
        <div className="space-y-2">
          <Label>Job family to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">{jobFamily.name}</p>
            {jobFamily._count && jobFamily._count.employees > 0 && (
              <p className="text-sm text-destructive mt-1">
                {jobFamily._count.employees} employee{jobFamily._count.employees !== 1 ? "s" : ""} assigned — cannot delete
              </p>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting || (jobFamily?._count?.employees ?? 0) > 0}
        >
          {isDeleting ? "Deleting..." : "Delete Job Family"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteJobFamilyDialog({
  open,
  onOpenChange,
  jobFamily,
  onJobFamilyDeleted,
}: DeleteJobFamilyDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Delete Job Family</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently delete &quot;{jobFamily?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm jobFamily={jobFamily} onJobFamilyDeleted={onJobFamilyDeleted} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DrawerTitle className="text-destructive">Delete Job Family</DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently delete &quot;{jobFamily?.name}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm className="px-4" jobFamily={jobFamily} onJobFamilyDeleted={onJobFamilyDeleted} onClose={handleClose} />
      </DrawerContent>
    </Drawer>
  );
}
