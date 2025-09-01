"use client";
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, PlusCircle, Search } from "lucide-react";
import { Training } from "@/generated/prisma_client";
import { NewTrainingDialog } from "@/components/dialogs/training/add-training-dialog";

interface TrainingSelectorProps {
  trainings: Training[];
  selectedTrainingId: number | null;
  onTrainingSelect: (trainingId: string) => void;
  onNewTraining: (training: Training) => void;
}

export function TrainingSelector({
  trainings,
  selectedTrainingId,
  onTrainingSelect,
  onNewTraining,
}: TrainingSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedTraining = trainings.find(
    (training) => training.id === selectedTrainingId,
  );

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTraining ? (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                {selectedTraining.title} ({selectedTraining.category})
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                Select training course
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-full p-0"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput
              placeholder="Search training courses..."
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No training courses found.</CommandEmpty>
              <CommandGroup>
                {trainings.map((training) => (
                  <CommandItem
                    key={training.id}
                    value={`${training.title} ${training.category}`}
                    onSelect={() => {
                      onTrainingSelect(training.id.toString());
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedTrainingId === training.id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {training.title} ({training.category})
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <NewTrainingDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTrainingCreated={onNewTraining}
      />
    </div>
  );
}
