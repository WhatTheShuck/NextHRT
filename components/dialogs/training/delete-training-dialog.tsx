"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Training } from "@/generated/prisma_client/client";

interface DeleteTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: Training | null;
  onTrainingDeleted?: (deleted: Training[]) => void;
}

interface DeleteFormProps {
  training: Training | null;
  onTrainingDeleted?: (deleted: Training[]) => void;
  onClose: () => void;
  className?: string;
}

function getSiblingTitle(title: string): string | null {
  if (title.endsWith(" - Task Sheet"))
    return title.slice(0, -" - Task Sheet".length) + " - Practical";
  if (title.endsWith(" - Practical"))
    return title.slice(0, -" - Practical".length) + " - Task Sheet";
  return null;
}

function DeleteForm({
  training,
  onTrainingDeleted,
  onClose,
  className,
}: DeleteFormProps) {
  const isSop = training?.category === "SOP";
  const siblingTitle = training ? getSiblingTitle(training.title) : null;
  const [deletePair, setDeletePair] = useState(true);
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
      const params = isSop && deletePair ? "?deletePair=true" : "";
      const response = await api.delete<Training[]>(
        `/api/training/${training.id}${params}`,
      );
      onTrainingDeleted?.(response.data);
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
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning</p>
            <p className="text-sm text-muted-foreground">
              {isSop
                ? "Deleting an SOP training permanently removes it from the system. Courses with existing training records cannot be deleted."
                : "Deleting this training course will remove it from your system permanently. Ensure no training records are currently associated with this course."}
            </p>
          </div>
        </div>
      </div>

      {training && (
        <div className="space-y-2">
          <Label>
            {isSop && deletePair
              ? "Training courses to be deleted:"
              : "Training course to be deleted:"}
          </Label>
          <div className="space-y-1">
            <div className="p-2 bg-muted rounded-md">
              <p className="font-medium">{training.title}</p>
              <p className="text-sm text-muted-foreground">
                Category: {training.category}
              </p>
            </div>
            {isSop && siblingTitle && deletePair && (
              <div className="p-2 bg-muted rounded-md">
                <p className="font-medium">{siblingTitle}</p>
                <p className="text-sm text-muted-foreground">
                  Category: SOP
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isSop && siblingTitle && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="delete-pair"
            checked={deletePair}
            onCheckedChange={(checked) => setDeletePair(checked === true)}
          />
          <label
            htmlFor="delete-pair"
            className="text-sm leading-none cursor-pointer"
          >
            Also delete paired training:{" "}
            <span className="font-medium">{siblingTitle}</span>
          </label>
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting
            ? "Deleting..."
            : isSop && deletePair && siblingTitle
              ? "Delete Both Training Courses"
              : "Delete Training Course"}
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

  const isSop = training?.category === "SOP";
  const description = isSop
    ? `This action cannot be undone. "${training?.title}" is part of an SOP pair — you can choose to delete both below.`
    : `This action cannot be undone. Are you sure you want to permanently delete the training course "${training?.title}"?`;

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
              {description}
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
          <DrawerDescription className="pt-2">{description}</DrawerDescription>
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
