"use client";
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Ticket } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { AxiosError } from "axios";

type NewTicketDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: (ticket: Ticket) => void;
};

export function NewTicketDialog({
  isOpen,
  onOpenChange,
  onTicketCreated,
}: NewTicketDialogProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [renewal, setRenewal] = useState("5");
  const [noExpiry, setNoExpiry] = useState(false);
  const [ticketCode, setTicketCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Small delay to avoid visual flickering when closing
      setTimeout(() => {
        setTitle("");
        setRenewal("5");
        setNoExpiry(false);
        setTicketCode("");
        setError("");
      }, 300);
    }

    // Prevent form submission when dialog opens/closes
    onOpenChange(open);
  };

  // Create new ticket
  const handleCreateTicket = async () => {
    if (!title.trim()) {
      setError("Ticket title is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const res = await api.post("/api/tickets", {
        ticketName: title.trim(),
        renewal: noExpiry ? null : parseInt(renewal) || 0,
        ticketCode: ticketCode.trim(),
      });

      const newTicket = await res.data;
      onTicketCreated(newTicket);
      handleOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        // Access Axios-specific error properties
        setError(
          err.response?.data?.message || err.message || "API error occurred",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create ticket. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Ticket Type</DialogTitle>
          <DialogDescription>
            Create a new ticket type to use in your allocation
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ticket-title">Ticket Title</Label>
            <Input
              id="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Driver's License"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-code">Ticket Code</Label>
            <Input
              id="ticket-code"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="e.g., FL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="renewal">Renewal Period</Label>

            <div className="flex items-center space-x-3">
              <Input
                id="renewal"
                type="number"
                min="1"
                value={renewal}
                onChange={(e) => setRenewal(e.target.value)}
                disabled={noExpiry}
                className={`w-20 ${noExpiry ? "opacity-50" : ""}`}
              />
              <span className="text-sm text-gray-500">years</span>

              <div className="flex items-center space-x-2 ml-4">
                <Checkbox
                  id="no-expiry"
                  checked={noExpiry}
                  onCheckedChange={(checked) => setNoExpiry(checked === true)}
                />
                <Label htmlFor="no-expiry" className="text-sm font-normal">
                  Does not expire
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTicket}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
