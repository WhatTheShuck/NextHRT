"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Training, Category } from "@/generated/prisma_client";
import { Switch } from "@/components/ui/switch";

interface EditTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: Training | null;
  onTrainingUpdated?: (training: Training) => void;
}

export function EditTrainingDialog({
  open,
  onOpenChange,
  training,
  onTrainingUpdated,
}: EditTrainingDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens/closes or training changes
  useEffect(() => {
    if (open && training) {
      setTitle(training.title || "");
      setCategory(training.category || "Internal");
      setIsActive(training.isActive ?? true);
      setError("");
    } else if (!open) {
      setTitle("");
      setCategory("Internal");
      setIsActive(true);
      setError("");
    }
  }, [open, training]);

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
      onOpenChange(false);
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
    onOpenChange(false);
  };

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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Training Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., First Aid Training"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <RadioGroup
              value={category}
              onValueChange={(val) => setCategory(val as Category)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Internal" id="internal" />
                <Label htmlFor="internal">Internal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="External" id="external" />
                <Label htmlFor="external">External</Label>
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Training Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
