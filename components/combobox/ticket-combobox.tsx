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
import { Ticket } from "@/generated/prisma_client";

interface TicketComboboxProps {
  tickets: Ticket[];
  onSelect: (ticketId: string) => void;
  selectedTicketId: number | null;
  disabled?: boolean;
  placeholder?: string;
}

export function TicketCombobox({
  tickets,
  onSelect,
  selectedTicketId,
  disabled = false,
  placeholder = "Search and select a ticket course...",
}: TicketComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedTicket = tickets.find(
    (ticket) => ticket.id === selectedTicketId,
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
          {selectedTicket ? (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedTicket.ticketName}
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
            placeholder="Search ticket courses..."
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>No ticket found.</CommandEmpty>
            <CommandGroup>
              {tickets.map((ticket) => (
                <CommandItem
                  key={ticket.id}
                  value={ticket.ticketName}
                  onSelect={() => {
                    onSelect(ticket.id.toString());
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedTicketId === ticket.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{ticket.ticketName}</span>
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
