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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
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
        <PopoverContent
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onWheel={(e) => e.stopPropagation()}
        >
          {" "}
          <LocationList
            locations={locations}
            selectedLocationId={selectedLocationId}
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
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerTitle className="px-4 text-left">Select a Location</DrawerTitle>
        <LocationList
          locations={locations}
          selectedLocationId={selectedLocationId}
          onSelect={onSelect}
          setOpen={setOpen}
        />
      </DrawerContent>
    </Drawer>
  );
}

function LocationList({
  locations,
  selectedLocationId,
  onSelect,
  setOpen,
}: {
  locations: Location[];
  selectedLocationId: number | null;
  onSelect: (locationId: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
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
  );
}
