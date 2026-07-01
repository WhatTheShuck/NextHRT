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
import { Program } from "@/generated/prisma_client/client";

interface DeleteProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  onProgramDeleted?: (program: Program) => void;
}

interface DeleteFormProps {
  program: Program | null;
  onProgramDeleted?: (program: Program) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({
  program,
  onProgramDeleted,
  onClose,
  className,
}: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!program) {
      alert("No program selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/programs/${program.id}`);

      onProgramDeleted?.(program);
      onClose();
    } catch (err: any) {
      console.error("Error deleting program:", err);
      alert(err.response?.data?.error || "Failed to delete program");
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
              Deleting this program will remove it from the onboarding catalogue
              permanently. Consider deactivating it instead if you may need it
              again.
            </p>
          </div>
        </div>
      </div>
      {program && (
        <div className="space-y-2">
          <Label>Program to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">{program.name}</p>
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
          {isDeleting ? "Deleting..." : "Delete Program"}
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

export function DeleteProgramDialog({
  open,
  onOpenChange,
  program,
  onProgramDeleted,
}: DeleteProgramDialogProps) {
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
                Delete Program
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently
              delete the program &quot;{program?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              program={program}
              onProgramDeleted={onProgramDeleted}
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
              Delete Program
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the program &quot;{program?.name}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          program={program}
          onProgramDeleted={onProgramDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
