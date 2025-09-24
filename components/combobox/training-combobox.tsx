"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, PlusCircle } from "lucide-react";
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
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedTraining = trainings.find(
    (training) => training.id.toString() === selectedTrainingId,
  );

  // Update trigger width when component mounts or opens
  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={
              showAddButton
                ? "w-full justify-between"
                : "w-[400px] justify-between"
            }
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
          style={{
            width: triggerWidth
              ? `${triggerWidth}px`
              : showAddButton
                ? "auto"
                : "400px",
          }}
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
        </PopoverContent>
      </Popover>

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
