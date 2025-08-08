"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import { Training } from "@/generated/prisma_client";

interface TrainingComboboxProps {
  trainings: Training[];
  onSelect: (trainingId: string) => void;
  selectedTrainingId: number | null;
  disabled?: boolean;
  placeholder?: string;
}

export function TrainingCombobox({
  trainings,
  onSelect,
  selectedTrainingId,
  disabled = false,
  placeholder = "Search and select a training course...",
}: TrainingComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedTraining = trainings.find(
    (training) => training.id === selectedTrainingId,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[400px] justify-between"
          disabled={disabled}
        >
          {selectedTraining ? (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedTraining.title}
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
      <PopoverContent className="w-[400px] p-0">
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
                  value={training.title}
                  onSelect={() => {
                    onSelect(training.id.toString());
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
                    <span className="font-medium">{training.title}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
