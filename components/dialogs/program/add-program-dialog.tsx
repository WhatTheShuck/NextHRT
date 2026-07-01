"use client";

import { useState } from "react";
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

interface AddProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProgramAdded?: (program: Program) => void;
}

interface ProgramFormProps {
  onProgramAdded?: (program: Program) => void;
  onClose: () => void;
  className?: string;
}

function ProgramForm({ onProgramAdded, onClose, className }: ProgramFormProps) {
  const [name, setName] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [infoRequired, setInfoRequired] = useState("");
  const [requiresReferenceUser, setRequiresReferenceUser] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setName("");
    setTicketNumber("");
    setInfoRequired("");
    setRequiresReferenceUser(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Please enter a program name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post<Program>("/api/programs", {
        name: name.trim(),
        ticketNumber: ticketNumber.trim() || null,
        infoRequired: infoRequired.trim() || null,
        requiresReferenceUser,
      });

      onProgramAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating program:", err);
      alert(err.response?.data?.error || "Failed to create program");
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
        <Label htmlFor="programName">Program Name</Label>
        <Input
          id="programName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., SAP"
          disabled={isCreating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="programTicketNumber">IT Ticket Number</Label>
        <Input
          id="programTicketNumber"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="e.g., 12345"
          disabled={isCreating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="programInfoRequired">Info Required</Label>
        <Textarea
          id="programInfoRequired"
          value={infoRequired}
          onChange={(e) => setInfoRequired(e.target.value)}
          placeholder="Information IT needs to provision this access"
          disabled={isCreating}
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
          disabled={isCreating}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Program"}
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

export function AddProgramDialog({
  open,
  onOpenChange,
  onProgramAdded,
}: AddProgramDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Program</DialogTitle>
            <DialogDescription>
              Create a new software-access program for the onboarding catalogue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ProgramForm onProgramAdded={onProgramAdded} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Program</DrawerTitle>
          <DrawerDescription>
            Create a new software-access program for the onboarding catalogue.
          </DrawerDescription>
        </DrawerHeader>
        <ProgramForm
          className="px-4 overflow-y-auto"
          onProgramAdded={onProgramAdded}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
