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
import { Ticket } from "@/generated/prisma_client";
import { NewTicketDialog } from "@/components/dialogs/tickets/add-ticket-dialog";

interface TicketComboboxProps {
  tickets: Ticket[];
  onSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  disabled?: boolean;
  placeholder?: string;
  // Legacy features - optional props
  showAddButton?: boolean;
  onNewTicket?: (ticket: Ticket) => void;
  label?: string;
}

export function TicketCombobox({
  tickets,
  onSelect,
  selectedTicketId,
  disabled = false,
  placeholder = "Search and select a ticket course...",
  showAddButton = false,
  onNewTicket,
  label = "Ticket Course",
}: TicketComboboxProps) {
  const [open, setOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedTicket = tickets.find(
    (ticket) => ticket.id.toString() === selectedTicketId,
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
          <Label htmlFor="ticket">{label}</Label>
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
            New Ticket
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
            className="w-full justify-between"
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
        <PopoverContent
          className="p-0"
          style={{ width: triggerWidth ? `${triggerWidth}px` : "auto" }}
        >
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
                        selectedTicketId === ticket.id.toString()
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

      {/* Only render the dialog if showAddButton is true and onNewTicket is provided */}
      {showAddButton && onNewTicket && (
        <NewTicketDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onTicketCreated={onNewTicket}
        />
      )}
    </div>
  );
}
