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
import { TicketRecordsWithRelations, EmployeeWithRelations } from "@/lib/types";
import { format } from "date-fns";

interface DeleteTicketRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketRecord: TicketRecordsWithRelations | null;
  onTicketRecordDeleted?: () => void;
  employee?: EmployeeWithRelations | null; // Optional employee data
}

export function DeleteTicketRecordDialog({
  open,
  onOpenChange,
  ticketRecord,
  employee,
  onTicketRecordDeleted,
}: DeleteTicketRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!ticketRecord) {
      alert("No ticket record selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/ticket-records/${ticketRecord.id}`);

      onTicketRecordDeleted?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting ticket record:", err);
      alert(err.response?.data?.error || "Failed to delete ticket record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-destructive">
              Delete Ticket Record
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the ticket record "{ticketRecord?.ticket?.ticketName}" for{" "}
            {employee?.firstName} {employee?.lastName}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Warning</p>
                <p className="text-sm text-muted-foreground">
                  Deleting this ticket record will permanently remove it from
                  the system. This action cannot be reversed.
                </p>
              </div>
            </div>
          </div>
          {ticketRecord && (
            <div className="space-y-2">
              <Label>Ticket record to be deleted:</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{ticketRecord.ticket?.ticketName}</p>
                <p className="text-sm text-muted-foreground">
                  Code: {ticketRecord.ticket?.ticketCode}
                </p>
                <p className="text-sm text-muted-foreground">
                  Licence Number: {ticketRecord.licenseNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  Date Issued: {format(new Date(ticketRecord.dateIssued), "PP")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Employee: {employee?.firstName} {employee?.lastName}
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
            {isDeleting ? "Deleting..." : "Delete Ticket Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
