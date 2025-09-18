"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Ticket } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { AxiosError } from "axios";

interface NewTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: (ticket: Ticket) => void;
}

interface TicketFormProps {
  onTicketCreated: (ticket: Ticket) => void;
  onClose: () => void;
  className?: string;
}

function TicketForm({ onTicketCreated, onClose, className }: TicketFormProps) {
  const [title, setTitle] = useState("");
  const [renewal, setRenewal] = useState("5");
  const [noExpiry, setNoExpiry] = useState(false);
  const [ticketCode, setTicketCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setTitle("");
    setRenewal("5");
    setNoExpiry(false);
    setTicketCode("");
    setError("");
  };

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
      onClose();
      resetForm();
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
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

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="ticket-title">Ticket Title</Label>
        <Input
          id="ticket-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., Driver's Licence"
          disabled={isCreating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-code">Ticket Code</Label>
        <Input
          id="ticket-code"
          value={ticketCode}
          onChange={(e) => {
            setTicketCode(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., FL"
          disabled={isCreating}
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
            disabled={noExpiry || isCreating}
            className={`w-20 ${noExpiry ? "opacity-50" : ""}`}
          />
          <span className="text-sm text-gray-500">years</span>

          <div className="flex items-center space-x-2 ml-4">
            <Checkbox
              id="no-expiry"
              checked={noExpiry}
              onCheckedChange={(checked) => setNoExpiry(checked === true)}
              disabled={isCreating}
            />
            <Label htmlFor="no-expiry" className="text-sm font-normal">
              Does not expire
            </Label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          onClick={handleCreateTicket}
          disabled={!title.trim() || isCreating}
        >
          {isCreating ? "Creating..." : "Create Ticket"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isCreating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function NewTicketDialog({
  isOpen,
  onOpenChange,
  onTicketCreated,
}: NewTicketDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Ticket Type</DialogTitle>
            <DialogDescription>
              Create a new ticket type to use in your allocation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TicketForm
              onTicketCreated={onTicketCreated}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Ticket Type</DrawerTitle>
          <DrawerDescription>
            Create a new ticket type to use in your allocation
          </DrawerDescription>
        </DrawerHeader>
        <TicketForm
          className="px-4"
          onTicketCreated={onTicketCreated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
