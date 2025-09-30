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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const selectedDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
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
        <PopoverContent
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onWheel={(e) => e.stopPropagation()}
        >
          <DepartmentList
            departments={departments}
            selectedDepartmentId={selectedDepartmentId}
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
      </DrawerTrigger>

      <DrawerContent className="max-h-[90vh]">
        <DrawerTitle className="px-4 text-left">Select Department</DrawerTitle>
        <DepartmentList
          departments={departments}
          selectedDepartmentId={selectedDepartmentId}
          onSelect={onSelect}
          setOpen={setOpen}
        />
      </DrawerContent>
    </Drawer>
  );
}

function DepartmentList({
  departments,
  selectedDepartmentId,
  onSelect,
  setOpen,
}: {
  departments: Department[];
  selectedDepartmentId: number | null;
  onSelect: (departmentId: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
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
  );
}
