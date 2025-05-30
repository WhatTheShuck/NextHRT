"use client";
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { Training } from "@/generated/prisma_client";
import { NewTrainingDialog } from "@/components/dialogs/new-training-dialog";

type TrainingSelectorProps = {
  trainings: Training[];
  selectedTrainingId: string;
  onTrainingSelect: (trainingId: string) => void;
  onNewTraining: (training: Training) => void;
};

export function TrainingSelector({
  trainings,
  selectedTrainingId,
  onTrainingSelect,
  onNewTraining,
}: TrainingSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor="training">Training Course</Label>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center"
          onClick={(e) => {
            e.preventDefault(); // Prevent form submission
            setIsDialogOpen(true);
          }}
          type="button" // Explicitly set button type to prevent form submission
        >
          <PlusCircle className="mr-1 h-4 w-4" />
          New Training
        </Button>
      </div>

      <Select value={selectedTrainingId} onValueChange={onTrainingSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select training course" />
          {/* add search in here somewhere  */}
        </SelectTrigger>
        <SelectContent>
          {trainings.map((training) => (
            <SelectItem key={training.id} value={training.id.toString()}>
              {training.title} ({training.category})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NewTrainingDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTrainingCreated={onNewTraining}
      />
    </div>
  );
}
