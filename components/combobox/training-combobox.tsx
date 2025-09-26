"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Search, PlusCircle } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Training } from "@/generated/prisma_client";
import { NewTrainingDialog } from "@/components/dialogs/training/add-training-dialog";

interface TrainingComboboxProps {
  trainings: Training[];
  onSelect: (trainingId: string) => void;
  selectedTrainingId: string | null;
  disabled?: boolean;
  placeholder?: string;
  // Legacy features - optional props
  showAddButton?: boolean;
  onNewTraining?: (training: Training) => void;
  label?: string;
}

export function TrainingCombobox({
  trainings,
  onSelect,
  selectedTrainingId,
  disabled = false,
  placeholder = "Search and select a training course...",
  showAddButton = false,
  onNewTraining,
  label = "Training Course",
}: TrainingComboboxProps) {
  const [open, setOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const selectedTraining = trainings.find(
    (training) => training.id.toString() === selectedTrainingId,
  );

  const ComboboxContent = () => {
    if (isDesktop) {
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled}
            >
              {selectedTraining ? (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  {selectedTraining.title} ({selectedTraining.category})
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {placeholder}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0"
            style={{ width: "var(--radix-popover-trigger-width)" }}
            onWheel={(e) => e.stopPropagation()}
          >
            <TrainingList
              trainings={trainings}
              selectedTrainingId={selectedTrainingId}
              onSelect={onSelect}
              setOpen={setOpen}
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedTraining ? (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                {selectedTraining.title} ({selectedTraining.category})
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                {placeholder}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <DrawerTitle className="px-4 text-left">
            Select a Training Course
          </DrawerTitle>
          <TrainingList
            trainings={trainings}
            selectedTrainingId={selectedTrainingId}
            onSelect={onSelect}
            setOpen={setOpen}
          />
        </DrawerContent>
      </Drawer>
    );
  };

  return (
    <div className="space-y-2">
      {showAddButton && (
        <div className="flex justify-between items-center">
          <Label htmlFor="training">{label}</Label>
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
      )}

      <ComboboxContent />

      {/* Only render the dialog if showAddButton is true and onNewTraining is provided */}
      {showAddButton && onNewTraining && (
        <NewTrainingDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onTrainingCreated={onNewTraining}
        />
      )}
    </div>
  );
}

function TrainingList({
  trainings,
  selectedTrainingId,
  onSelect,
  setOpen,
}: {
  trainings: Training[];
  selectedTrainingId: string | null;
  onSelect: (trainingId: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search training courses..." className="h-9" />
      <CommandList>
        <CommandEmpty>No training courses found.</CommandEmpty>
        <CommandGroup>
          {trainings.map((training) => (
            <CommandItem
              key={training.id}
              value={`${training.title} ${training.category}`}
              onSelect={() => {
                onSelect(training.id.toString());
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <Check
                className={`mr-2 h-4 w-4 ${
                  selectedTrainingId === training.id.toString()
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
  );
}
