"use client";
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { Ticket } from "@/generated/prisma_client";
import { NewTicketDialog } from "@/components/dialogs/new-ticket-dialog";

type TicketSelectorProps = {
  tickets: Ticket[];
  selectedTicketId: string;
  onTicketSelect: (ticketId: string) => void;
  onNewTicket: (ticket: Ticket) => void;
};

export function TicketSelector({
  tickets,
  selectedTicketId,
  onTicketSelect,
  onNewTicket,
}: TicketSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor="ticket">Ticket Course</Label>
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

      <Select value={selectedTicketId} onValueChange={onTicketSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select ticket course" />
          {/* add search in here somewhere  */}
        </SelectTrigger>
        <SelectContent>
          {tickets.map((ticket) => (
            <SelectItem key={ticket.id} value={ticket.id.toString()}>
              {ticket.ticketName} ({ticket.ticketCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NewTicketDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onTicketCreated={onNewTicket}
      />
    </div>
  );
}
