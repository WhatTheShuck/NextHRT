"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Training, Category } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { AxiosError } from "axios";

interface NewTrainingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTrainingCreated: (training: Training) => void;
}

interface TrainingFormProps {
  onTrainingCreated: (training: Training) => void;
  onClose: () => void;
  className?: string;
}

function TrainingForm({
  onTrainingCreated,
  onClose,
  className,
}: TrainingFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setTitle("");
    setCategory("Internal");
    setError("");
  };

  const handleCreateTraining = async () => {
    if (!title.trim()) {
      setError("Training title is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const res = await api.post("/api/training", {
        title: title.trim(),
        category,
      });

      const newTraining = await res.data;
      onTrainingCreated(newTraining);
      onClose();
      resetForm();
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.message || err.message || "API error occurred",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create training. Please try again.");
      }
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
        <Label htmlFor="training-title">Training Title</Label>
        <Input
          id="training-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., First Aid Training"
          disabled={isCreating}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <RadioGroup
          value={category}
          onValueChange={(val) => setCategory(val as Category)}
          disabled={isCreating}
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

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          onClick={handleCreateTraining}
          disabled={!title.trim() || isCreating}
        >
          {isCreating ? "Creating..." : "Create Training"}
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

export function NewTrainingDialog({
  isOpen,
  onOpenChange,
  onTrainingCreated,
}: NewTrainingDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Training Type</DialogTitle>
            <DialogDescription>
              Create a new training type to use in your allocation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TrainingForm
              onTrainingCreated={onTrainingCreated}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Training Type</DrawerTitle>
          <DrawerDescription>
            Create a new training type to use in your allocation
          </DrawerDescription>
        </DrawerHeader>
        <TrainingForm
          className="px-4"
          onTrainingCreated={onTrainingCreated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
