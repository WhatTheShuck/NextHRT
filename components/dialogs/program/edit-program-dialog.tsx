"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Program } from "@/generated/prisma_client/client";

interface EditProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  onProgramUpdated?: (program: Program) => void;
}

interface ProgramEditFormProps {
  open: boolean;
  program: Program | null;
  onProgramUpdated?: (program: Program) => void;
  onClose: () => void;
  className?: string;
}

function ProgramEditForm({
  open,
  program,
  onProgramUpdated,
  onClose,
  className,
}: ProgramEditFormProps) {
  const [name, setName] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [infoRequired, setInfoRequired] = useState("");
  const [requiresReferenceUser, setRequiresReferenceUser] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open && program) {
      setName(program.name || "");
      setTicketNumber(program.ticketNumber || "");
      setInfoRequired(program.infoRequired || "");
      setRequiresReferenceUser(program.requiresReferenceUser ?? false);
      setIsActive(program.isActive ?? true);
    } else if (!open) {
      setName("");
      setTicketNumber("");
      setInfoRequired("");
      setRequiresReferenceUser(false);
      setIsActive(true);
    }
  }, [open, program]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      alert("Please enter a program name");
      return;
    }
    if (!program) {
      alert("No program selected");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await api.put<Program>(`/api/programs/${program.id}`, {
        name: name.trim(),
        ticketNumber: ticketNumber.trim() || null,
        infoRequired: infoRequired.trim() || null,
        requiresReferenceUser,
        isActive,
      });

      onProgramUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating program:", err);
      alert(err.response?.data?.error || "Failed to update program");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="programName">Program Name</Label>
        <Input
          id="programName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., SAP"
          disabled={isUpdating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="programTicketNumber">IT Ticket Number</Label>
        <Input
          id="programTicketNumber"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="e.g., 12345"
          disabled={isUpdating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="programInfoRequired">Info Required</Label>
        <Textarea
          id="programInfoRequired"
          value={infoRequired}
          onChange={(e) => setInfoRequired(e.target.value)}
          placeholder="Information IT needs to provision this access"
          disabled={isUpdating}
        />
      </div>
      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label
            htmlFor="programRequiresReferenceUser"
            className="text-sm font-medium"
          >
            Requires Reference User
          </Label>
          <p className="text-xs text-muted-foreground">
            Require a reference user to be selected when this program is chosen
          </p>
        </div>
        <Switch
          id="programRequiresReferenceUser"
          checked={requiresReferenceUser}
          onCheckedChange={setRequiresReferenceUser}
          disabled={isUpdating}
        />
      </div>
      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label htmlFor="programIsActive" className="text-sm font-medium">
            Program Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable or disable this program
          </p>
        </div>
        <Switch
          id="programIsActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isUpdating}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Program"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditProgramDialog({
  open,
  onOpenChange,
  program,
  onProgramUpdated,
}: EditProgramDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Program</DialogTitle>
            <DialogDescription>
              Update this program&apos;s details in the onboarding catalogue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ProgramEditForm
              open={open}
              program={program}
              onProgramUpdated={onProgramUpdated}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Program</DrawerTitle>
          <DrawerDescription>
            Update this program&apos;s details in the onboarding catalogue.
          </DrawerDescription>
        </DrawerHeader>
        <ProgramEditForm
          className="px-4 overflow-y-auto"
          open={open}
          program={program}
          onProgramUpdated={onProgramUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
