"use client";
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Training, Category } from "@prisma/client";

type NewTrainingDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTrainingCreated: (training: Training) => void;
};

export function NewTrainingDialog({
  isOpen,
  onOpenChange,
  onTrainingCreated,
}: NewTrainingDialogProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [renewalPeriod, setRenewalPeriod] = useState("12");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Small delay to avoid visual flickering when closing
      setTimeout(() => {
        setTitle("");
        setCategory("Internal");
        setRenewalPeriod("12");
        setError("");
      }, 300);
    }

    // Prevent form submission when dialog opens/closes
    onOpenChange(open);
  };

  // Create new training
  const handleCreateTraining = async () => {
    if (!title.trim()) {
      setError("Training title is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          RenewalPeriod: parseInt(renewalPeriod) || 0,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create training");
      }

      const newTraining = await res.json();
      onTrainingCreated(newTraining);
      handleOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to create training. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Training Type</DialogTitle>
          <DialogDescription>
            Create a new training type to use in your allocation
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="training-title">Training Title</Label>
            <Input
              id="training-title"
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

          <div className="space-y-2">
            <Label htmlFor="renewal">Renewal Period (months)</Label>
            <Input
              id="renewal"
              type="number"
              min="0"
              value={renewalPeriod}
              onChange={(e) => setRenewalPeriod(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTraining}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Training"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
