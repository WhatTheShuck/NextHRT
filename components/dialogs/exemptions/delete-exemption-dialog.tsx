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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { AlertTriangle } from "lucide-react";
import { TrainingTicketExemption } from "@/generated/prisma_client";
import { TrainingTicketExemptionWithRelations } from "@/lib/types";

interface DeleteTrainingTicketExemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exemption: TrainingTicketExemptionWithRelations | null;
  onTrainingTicketExemptionDeleted?: (
    exemption: TrainingTicketExemption,
  ) => void;
}

interface DeleteFormProps {
  exemption: TrainingTicketExemptionWithRelations | null;
  onTrainingTicketExemptionDeleted?: (
    exemption: TrainingTicketExemption,
  ) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({
  exemption,
  onTrainingTicketExemptionDeleted,
  onClose,
  className,
}: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!exemption) {
      alert("No exemption selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/exemption/${exemption.id}`);

      onTrainingTicketExemptionDeleted?.(exemption);
      onClose();
    } catch (err: any) {
      console.error("Error deleting exemption:", err);
      alert(err.response?.data?.error || "Failed to delete exemption");
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
              Deleting this exemption will remove it from the system
              permanently. Only proceed if this exemption was placed in error. A
              revoked exemption should be edited to be revoked, rather than
              deleted.
            </p>
          </div>
        </div>
      </div>
      {exemption && (
        <div className="space-y-2">
          <Label>Exemption to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">
              {exemption.type === "Ticket"
                ? exemption.ticket?.ticketName
                : exemption.training?.title}
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
          {isDeleting ? "Deleting..." : "Delete TrainingTicketExemption"}
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

export function DeleteTrainingTicketExemptionDialog({
  open,
  onOpenChange,
  exemption,
  onTrainingTicketExemptionDeleted,
}: DeleteTrainingTicketExemptionDialogProps) {
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
                Delete Exemption
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently
              delete the exemption &quot;
              {exemption?.type === "Ticket"
                ? exemption?.ticket?.ticketName
                : exemption?.training?.title}
              &quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              exemption={exemption}
              onTrainingTicketExemptionDeleted={
                onTrainingTicketExemptionDeleted
              }
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
              Delete TrainingTicketExemption
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the exemption &quot;{exemption?.name}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          exemption={exemption}
          onTrainingTicketExemptionDeleted={onTrainingTicketExemptionDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
