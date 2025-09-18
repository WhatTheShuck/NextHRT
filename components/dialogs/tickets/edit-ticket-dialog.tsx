"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";

interface EditTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onTicketUpdated?: (ticket: Ticket) => void;
}

interface TicketFormProps {
  ticket: Ticket | null;
  onTicketUpdated?: (ticket: Ticket) => void;
  onClose: () => void;
  className?: string;
}

function TicketForm({
  ticket,
  onTicketUpdated,
  onClose,
  className,
}: TicketFormProps) {
  const [ticketName, setTicketName] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [renewal, setRenewal] = useState("5");
  const [noExpiry, setNoExpiry] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when ticket changes
  useEffect(() => {
    if (ticket) {
      setTicketName(ticket.ticketName || "");
      setTicketCode(ticket.ticketCode || "");
      setRenewal(ticket.renewal ? ticket.renewal.toString() : "5");
      setNoExpiry(ticket.renewal === null);
      setIsActive(ticket.isActive ?? true);
      setError("");
    }
  }, [ticket]);

  const resetForm = () => {
    setTicketName("");
    setTicketCode("");
    setRenewal("5");
    setNoExpiry(false);
    setIsActive(true);
    setError("");
  };

  const handleUpdate = async () => {
    if (!ticketName.trim()) {
      setError("Ticket name is required");
      return;
    }
    if (!ticketCode.trim()) {
      setError("Ticket code is required");
      return;
    }

    if (!ticket) {
      setError("No ticket selected");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const response = await api.put<Ticket>(`/api/tickets/${ticket.id}`, {
        ticketName: ticketName.trim(),
        ticketCode: ticketCode.trim(),
        renewal: noExpiry ? null : parseInt(renewal) || 0,
        isActive,
      });

      onTicketUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating ticket:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to update ticket",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="ticketName">Ticket Name</Label>
        <Input
          id="ticketName"
          value={ticketName}
          onChange={(e) => {
            setTicketName(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., Driver's Licence"
          disabled={isUpdating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticketCode">Ticket Code</Label>
        <Input
          id="ticketCode"
          value={ticketCode}
          onChange={(e) => {
            setTicketCode(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., DL"
          disabled={isUpdating}
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
            disabled={noExpiry || isUpdating}
            className={`w-20 ${noExpiry ? "opacity-50" : ""}`}
          />
          <span className="text-sm text-gray-500">years</span>

          <div className="flex items-center space-x-2 ml-4">
            <Checkbox
              id="no-expiry"
              checked={noExpiry}
              onCheckedChange={(checked) => setNoExpiry(checked === true)}
              disabled={isUpdating}
            />
            <Label htmlFor="no-expiry" className="text-sm font-normal">
              Does not expire
            </Label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label htmlFor="isActive" className="text-sm font-medium">
            Ticket Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable or disable this Ticket
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isUpdating}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Ticket"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditTicketDialog({
  open,
  onOpenChange,
  ticket,
  onTicketUpdated,
}: EditTicketDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription>
              Update the ticket details. This change will affect all employees
              assigned to this ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TicketForm
              ticket={ticket}
              onTicketUpdated={onTicketUpdated}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Ticket</DrawerTitle>
          <DrawerDescription>
            Update the ticket details. This change will affect all employees
            assigned to this ticket.
          </DrawerDescription>
        </DrawerHeader>
        <TicketForm
          className="px-4"
          ticket={ticket}
          onTicketUpdated={onTicketUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
