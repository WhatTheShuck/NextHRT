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
import { MedicalStandard } from "@/generated/prisma_client/client";

interface MedicalStandardWithCount extends MedicalStandard {
  _count?: {
    onboardingRequests: number;
  };
}

interface DeleteMedicalStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicalStandard: MedicalStandardWithCount | null;
  onMedicalStandardDeleted?: (medicalStandard: MedicalStandard) => void;
}

interface DeleteFormProps {
  medicalStandard: MedicalStandardWithCount | null;
  onMedicalStandardDeleted?: (medicalStandard: MedicalStandard) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({
  medicalStandard,
  onMedicalStandardDeleted,
  onClose,
  className,
}: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const requestCount = medicalStandard?._count?.onboardingRequests ?? 0;

  const handleDelete = async () => {
    if (!medicalStandard) {
      alert("No medical standard selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/medical-standards/${medicalStandard.id}`);

      onMedicalStandardDeleted?.(medicalStandard);
      onClose();
    } catch (err: any) {
      console.error("Error deleting medical standard:", err);
      alert(err.response?.data?.error || "Failed to delete medical standard");
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
              Deleting this medical standard will remove it from your system
              permanently.
            </p>
            {requestCount > 0 && (
              <p className="text-sm text-destructive font-medium">
                This medical standard is referenced by {requestCount} onboarding{" "}
                {requestCount === 1 ? "request" : "requests"} and cannot be
                deleted.
              </p>
            )}
          </div>
        </div>
      </div>
      {medicalStandard && (
        <div className="space-y-2">
          <Label>Medical standard to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">{medicalStandard.name}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting || requestCount > 0}
        >
          {isDeleting ? "Deleting..." : "Delete Medical Standard"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteMedicalStandardDialog({
  open,
  onOpenChange,
  medicalStandard,
  onMedicalStandardDeleted,
}: DeleteMedicalStandardDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">
                Delete Medical Standard
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently
              delete the medical standard &quot;{medicalStandard?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              medicalStandard={medicalStandard}
              onMedicalStandardDeleted={onMedicalStandardDeleted}
              onClose={handleClose}
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
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DrawerTitle className="text-destructive">
              Delete Medical Standard
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the medical standard &quot;{medicalStandard?.name}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          medicalStandard={medicalStandard}
          onMedicalStandardDeleted={onMedicalStandardDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
