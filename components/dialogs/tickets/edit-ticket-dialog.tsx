"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ticket } from "@/generated/prisma_client";
import { Switch } from "@/components/ui/switch";

interface EditTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onTicketUpdated?: (ticket: Ticket) => void;
}

export function EditTicketDialog({
  open,
  onOpenChange,
  ticket,
  onTicketUpdated,
}: EditTicketDialogProps) {
  const [ticketName, setTicketName] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [renewal, setRenewal] = useState("5");
  const [noExpiry, setNoExpiry] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens/closes or ticket changes
  useEffect(() => {
    if (open && ticket) {
      setTicketName(ticket.ticketName || "");
      setTicketCode(ticket.ticketCode || "");
      setRenewal(ticket.renewal ? ticket.renewal.toString() : "5");
      setNoExpiry(ticket.renewal === null);
      setIsActive(ticket.isActive ?? true);
      setError("");
    } else if (!open) {
      setTicketName("");
      setTicketCode("");
      setRenewal("5");
      setNoExpiry(false);
      setIsActive(true);
      setError("");
    }
  }, [open, ticket]);

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
      onOpenChange(false);
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
    onOpenChange(false);
  };

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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ticketName">Ticket Name</Label>
            <Input
              id="ticketName"
              value={ticketName}
              onChange={(e) => setTicketName(e.target.value)}
              placeholder="e.g., Driver's Licence"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticketCode">Ticket Code</Label>
            <Input
              id="ticketCode"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="e.g., DL"
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
