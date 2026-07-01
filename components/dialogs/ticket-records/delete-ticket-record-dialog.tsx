"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { AlertTriangle } from "lucide-react";
import { TicketRecordsWithRelations, EmployeeWithRelations } from "@/lib/types";
import { format } from "date-fns";

interface DeleteTicketRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketRecord: TicketRecordsWithRelations | null;
  onTicketRecordDeleted?: () => void;
  employee?: EmployeeWithRelations | null;
}

interface DeleteFormProps {
  ticketRecord: TicketRecordsWithRelations | null;
  employee?: EmployeeWithRelations | null;
  onTicketRecordDeleted?: () => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({
  ticketRecord,
  employee,
  onTicketRecordDeleted,
  onClose,
  className,
}: DeleteFormProps) {
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
      onClose();
    } catch (err: any) {
      console.error("Error deleting ticket record:", err);
      alert(err.response?.data?.error || "Failed to delete ticket record");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning</p>
            <p className="text-sm text-muted-foreground">
              Deleting this ticket record will permanently remove it from the
              system. This action cannot be reversed.
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
              Employee: {employee?.legalFirstName} {employee?.legalLastName}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete Ticket Record"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DeleteTicketRecordDialog({
  open,
  onOpenChange,
  ticketRecord,
  employee,
  onTicketRecordDeleted,
}: DeleteTicketRecordDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
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
              delete the ticket record &quot;
              {ticketRecord?.ticket?.ticketName}&quot; for{" "}
              {employee?.legalFirstName} {employee?.legalLastName}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              ticketRecord={ticketRecord}
              employee={employee}
              onTicketRecordDeleted={onTicketRecordDeleted}
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
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DrawerTitle className="text-destructive">
              Delete Ticket Record
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the ticket record &quot;{ticketRecord?.ticket?.ticketName}
            &quot; for {employee?.legalFirstName} {employee?.legalLastName}?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          ticketRecord={ticketRecord}
          employee={employee}
          onTicketRecordDeleted={onTicketRecordDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
