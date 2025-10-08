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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Ticket } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import {
  RequirementSelector,
  RequirementPair,
} from "@/components/requirement-selector";

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
  const [requirements, setRequirements] = useState<RequirementPair[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedRequirements, setHasUnsavedRequirements] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unsavedDetails, setUnsavedDetails] = useState<{
    departmentName: string;
    locationName: string;
  } | null>(null);

  const resetForm = () => {
    setTitle("");
    setRenewal("5");
    setNoExpiry(false);
    setTicketCode("");
    setRequirements([]);
    setError("");
    setHasUnsavedRequirements(false);
    setUnsavedDetails(null);
  };

  const proceedWithSubmission = async () => {
    setShowUnsavedDialog(false);
    await submitTicket();
  };
  const submitTicket = async () => {
    setIsCreating(true);
    setError("");

    try {
      const payload: any = {
        ticketName: title.trim(),
        renewal: noExpiry ? null : parseInt(renewal) || 0,
        ticketCode: ticketCode.trim(),
      };

      // Add requirements if they exist
      if (requirements.length > 0) {
        payload.requirements = requirements.map((req) => ({
          departmentId: req.departmentId,
          locationId: req.locationId,
        }));
      }

      const res = await api.post("/api/tickets", payload);

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

  const handleCreateTicket = async () => {
    if (!title.trim()) {
      setError("Ticket title is required");
      return;
    }

    if (hasUnsavedRequirements) {
      setShowUnsavedDialog(true);
      return;
    }
    await submitTicket();
  };
  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <>
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
        <div className="border-t pt-4">
          <RequirementSelector
            value={requirements}
            onChange={setRequirements}
            disabled={isCreating}
            onUnsavedChanges={setHasUnsavedRequirements}
          />
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
      {/* Unsaved Requirements Confirmation Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Requirement Selection</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              You have selected a department and location combination that
              hasn't been added to your requirements:
              {unsavedDetails && (
                <div className="bg-muted p-3 rounded-md">
                  {unsavedDetails.departmentName} -{" "}
                  {unsavedDetails.locationName}
                </div>
              )}
              Would you like to proceed without adding this requirement, or go
              back to add it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back & Add It</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSubmission}>
              Proceed Without Adding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
      <DrawerContent className="max-h-[90vh]">
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
