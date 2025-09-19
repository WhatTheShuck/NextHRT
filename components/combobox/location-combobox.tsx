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
import { Location } from "@/generated/prisma_client";

interface LocationComboboxProps {
  locations: Location[];
  onSelect: (locationId: string) => void;
  selectedLocationId: number | null;
  disabled?: boolean;
  placeholder?: string;
}

export function LocationCombobox({
  locations,
  onSelect,
  selectedLocationId,
  disabled = false,
  placeholder = "Search and select a location...",
}: LocationComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
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
          {selectedLocation ? (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedLocation.name}
              {selectedLocation.state && selectedLocation.state !== "N/A" && (
                <span className="text-muted-foreground">
                  ({selectedLocation.state})
                </span>
              )}
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
          <CommandInput placeholder="Search locations..." className="h-9" />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              {locations.map((location) => (
                <CommandItem
                  key={location.id}
                  value={`${location.name} ${location.state}`}
                  onSelect={() => {
                    onSelect(location.id.toString());
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedLocationId === location.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{location.name}</span>
                    {location.state && location.state !== "N/A" && (
                      <span className="text-xs text-muted-foreground">
                        {location.state}
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
