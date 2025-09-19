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
import { Department } from "@/generated/prisma_client";

interface DepartmentComboboxProps {
  departments: Department[];
  onSelect: (departmentId: string) => void;
  selectedDepartmentId: number | null;
  disabled?: boolean;
  placeholder?: string;
}

export function DepartmentCombobox({
  departments,
  onSelect,
  selectedDepartmentId,
  disabled = false,
  placeholder = "Search and select a department...",
}: DepartmentComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
  );

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
          {selectedDepartment ? (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedDepartment.name}
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
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search departments..." className="h-9" />
          <CommandList>
            <CommandEmpty>No department found.</CommandEmpty>
            <CommandGroup>
              {departments.map((department) => (
                <CommandItem
                  key={department.id}
                  value={department.name}
                  onSelect={() => {
                    onSelect(department.id.toString());
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedDepartmentId === department.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{department.name}</span>
                    {department.level > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Level {department.level}
                      </span>
                    )}
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
