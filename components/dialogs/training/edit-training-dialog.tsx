"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Training, Category } from "@/generated/prisma_client";
import { Switch } from "@/components/ui/switch";

interface EditTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: Training | null;
  onTrainingUpdated?: (training: Training) => void;
}

interface TrainingFormProps {
  training: Training | null;
  onTrainingUpdated?: (training: Training) => void;
  onClose: () => void;
  className?: string;
}

function TrainingForm({
  training,
  onTrainingUpdated,
  onClose,
  className,
}: TrainingFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when training changes
  useEffect(() => {
    if (training) {
      setTitle(training.title || "");
      setCategory(training.category || "Internal");
      setIsActive(training.isActive ?? true);
      setError("");
    }
  }, [training]);

  const resetForm = () => {
    setTitle("");
    setCategory("Internal");
    setIsActive(true);
    setError("");
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError("Training title is required");
      return;
    }

    if (!training) {
      setError("No training selected");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const response = await api.put<Training>(`/api/training/${training.id}`, {
        title: title.trim(),
        category,
        isActive,
      });

      onTrainingUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating training:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to update training course",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="title">Training Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., First Aid Training"
          disabled={isUpdating}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <RadioGroup
          value={category}
          onValueChange={(val) => setCategory(val as Category)}
          disabled={isUpdating}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Internal" id="internal" />
            <Label htmlFor="internal">Internal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="External" id="external" />
            <Label htmlFor="external">External</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="SOP" id="sop" />
            <Label htmlFor="sop">SOP</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label htmlFor="isActive" className="text-sm font-medium">
            Training Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable or disable this training course
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isUpdating}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Training Course"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditTrainingDialog({
  open,
  onOpenChange,
  training,
  onTrainingUpdated,
}: EditTrainingDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Training Course</DialogTitle>
            <DialogDescription>
              Update the training course details. This change will affect all
              training records associated with this course.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TrainingForm
              training={training}
              onTrainingUpdated={onTrainingUpdated}
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
          <DrawerTitle>Edit Training Course</DrawerTitle>
          <DrawerDescription>
            Update the training course details. This change will affect all
            training records associated with this course.
          </DrawerDescription>
        </DrawerHeader>
        <TrainingForm
          className="px-4"
          training={training}
          onTrainingUpdated={onTrainingUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
