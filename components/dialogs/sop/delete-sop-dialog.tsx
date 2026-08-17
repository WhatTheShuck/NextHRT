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
import { practicalTitle, taskSheetTitle } from "@/lib/sop/pairing";
import { SopSummary } from "@/lib/services/sopService";

interface DeleteSopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sop: SopSummary | null;
  onSopDeleted: (taskSheetId: number) => void;
}

function DeleteSopForm({
  sop,
  onSopDeleted,
  onClose,
  className,
}: {
  sop: SopSummary;
  onSopDeleted: (taskSheetId: number) => void;
  onClose: () => void;
  className?: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");
    try {
      await api.delete(`/api/training/${sop.taskSheetId}?deletePair=true`);
      onSopDeleted(sop.taskSheetId);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error ?? err.message ?? "Failed to delete SOP",
      );
    } finally {
      setIsDeleting(false);
    }
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
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning</p>
            <p className="text-sm text-muted-foreground">
              Both halves of the SOP, and their revisions, questions and
              procedure documents, are removed permanently. An SOP with training
              records or started assessments cannot be deleted — deactivate it
              instead.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Trainings to be deleted:</Label>
        <div className="space-y-1">
          <div className="p-2 bg-muted rounded-md text-sm font-medium">
            {taskSheetTitle(sop.title)}
          </div>
          {sop.paired && (
            <div className="p-2 bg-muted rounded-md text-sm font-medium">
              {practicalTitle(sop.title)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete SOP"}
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

export function DeleteSopDialog({
  open,
  onOpenChange,
  sop,
  onSopDeleted,
}: DeleteSopDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (!sop) return null;

  const description = `This action cannot be undone. "${sop.title}" is deleted as a pair.`;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Delete SOP</DialogTitle>
            </div>
            <DialogDescription className="pt-2">{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteSopForm
              sop={sop}
              onSopDeleted={onSopDeleted}
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
            <DrawerTitle className="text-destructive">Delete SOP</DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">{description}</DrawerDescription>
        </DrawerHeader>
        <DeleteSopForm
          className="px-4"
          sop={sop}
          onSopDeleted={onSopDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
