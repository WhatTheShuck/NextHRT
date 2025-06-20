"use client";

import { useState } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { Ticket } from "@/generated/prisma_client";

interface DeleteTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
  onTicketDeleted?: (ticket: Ticket) => void;
}

export function DeleteTicketDialog({
  open,
  onOpenChange,
  ticket,
  onTicketDeleted,
}: DeleteTicketDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!ticket) {
      setError("No ticket selected");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await api.delete(`/api/tickets/${ticket.id}`);

      onTicketDeleted?.(ticket);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting ticket:", err);
      setError(
        err.response?.data?.error || err.message || "Failed to delete ticket",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-destructive">
              Delete Ticket
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the ticket "{ticket?.ticketName}"?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Warning</p>
                <p className="text-sm text-muted-foreground">
                  Deleting this ticket will remove it from your system
                  permanently. Make sure no employees currently hold this
                  ticket.
                </p>
              </div>
            </div>
          </div>
          {ticket && (
            <div className="space-y-2">
              <Label>Ticket to be deleted:</Label>
              <div className="p-2 bg-muted rounded-md">
                <p className="font-medium">{ticket.ticketName}</p>
                <p className="text-sm text-muted-foreground">
                  Code: {ticket.ticketCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  Renewal:{" "}
                  {ticket.renewal ? `${ticket.renewal} years` : "No expiry"}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
