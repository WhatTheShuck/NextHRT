"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
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
import { Employee } from "@/generated/prisma_client";

interface EmployeeComboboxProps {
  employees: Employee[];
  onSelect: (employeeId: string) => void;
  selectedEmployeeId: string | null;
  disabled?: boolean;
  placeholder?: string;
}

export function EmployeeCombobox({
  employees,
  onSelect,
  selectedEmployeeId,
  disabled = false,
  placeholder = "Search and select an employee...",
}: EmployeeComboboxProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const selectedEmployee = employees.find(
    (employee) => employee.id.toString() === selectedEmployeeId,
  );

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
            {selectedEmployee ? (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                {selectedEmployee.firstName} {selectedEmployee.lastName}
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
          <EmployeeList
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
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
          {selectedEmployee ? (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedEmployee.firstName} {selectedEmployee.lastName}
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
        <DrawerTitle className="px-4 text-left">Select Employee</DrawerTitle>
        <EmployeeList
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelect={onSelect}
          setOpen={setOpen}
        />
      </DrawerContent>
    </Drawer>
  );
}

function EmployeeList({
  employees,
  selectedEmployeeId,
  onSelect,
  setOpen,
}: {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search employees..." className="h-9" />
      <CommandList>
        <CommandEmpty>No employee found.</CommandEmpty>
        <CommandGroup>
          {employees.map((employee) => (
            <CommandItem
              key={employee.id}
              value={employee.firstName + " " + employee.lastName}
              onSelect={() => {
                onSelect(employee.id.toString());
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <Check
                className={`mr-2 h-4 w-4 ${
                  selectedEmployeeId === employee.id.toString()
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              />
              <div className="flex flex-col">
                <span className="font-medium">
                  {employee.firstName} {employee.lastName}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
