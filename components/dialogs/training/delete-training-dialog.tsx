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
import { Training } from "@/generated/prisma_client";

interface DeleteTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: Training | null;
  onTrainingDeleted?: (training: Training) => void;
}

interface DeleteFormProps {
  training: Training | null;
  onTrainingDeleted?: (training: Training) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({
  training,
  onTrainingDeleted,
  onClose,
  className,
}: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!training) {
      setError("No training selected");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await api.delete(`/api/training/${training.id}`);

      onTrainingDeleted?.(training);
      onClose();
    } catch (err: any) {
      console.error("Error deleting training:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to delete training course",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning</p>
            <p className="text-sm text-muted-foreground">
              Deleting this training course will remove it from your system
              permanently. Ensure no training records are currently associated
              with this course.
            </p>
          </div>
        </div>
      </div>

      {training && (
        <div className="space-y-2">
          <Label>Training course to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">{training.title}</p>
            <p className="text-sm text-muted-foreground">
              Category: {training.category}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete Training Course"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteTrainingDialog({
  open,
  onOpenChange,
  training,
  onTrainingDeleted,
}: DeleteTrainingDialogProps) {
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
                Delete Training Course
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently
              delete the training course &quot;{training?.title}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              training={training}
              onTrainingDeleted={onTrainingDeleted}
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
              Delete Training Course
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the training course &quot;{training?.title}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          training={training}
          onTrainingDeleted={onTrainingDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
