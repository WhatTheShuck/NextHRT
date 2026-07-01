"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Location, UserRole } from "@/generated/prisma_client/client";

export interface PendingLocation {
  id: string; // "pending-{orgRequestId}"
  orgRequestId: number;
  name: string;
  state: string;
  isPending: true;
}

interface AddLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationAdded?: (location: Location) => void;
  onLocationRequested?: (pending: PendingLocation) => void;
  userRole?: UserRole | null;
}

interface LocationFormProps {
  onLocationAdded?: (location: Location) => void;
  onLocationRequested?: (pending: PendingLocation) => void;
  onClose: () => void;
  isRequestMode: boolean;
  className?: string;
}

function LocationForm({
  onLocationAdded,
  onLocationRequested,
  onClose,
  isRequestMode,
  className,
}: LocationFormProps) {
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLocationName("");
    setLocationState("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!locationName.trim() || !locationState.trim()) {
      setError("Please enter both location name and state");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (isRequestMode) {
      try {
        const response = await api.post<{ id: number }>("/api/org-requests", {
          type: "Location",
          requestedData: { name: locationName.trim(), state: locationState.trim() },
        });
        onLocationRequested?.({
          id: `pending-${response.data.id}`,
          orgRequestId: response.data.id,
          name: locationName.trim(),
          state: locationState.trim(),
          isPending: true,
        });
        onClose();
        resetForm();
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to submit request");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        const response = await api.post<Location>("/api/locations", {
          name: locationName.trim(),
          state: locationState.trim(),
        });
        onLocationAdded?.(response.data);
        onClose();
        resetForm();
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to create location");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {isRequestMode && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
          This location doesn't exist yet. Submitting a request will notify an admin who can approve it. You can continue filling out the form in the meantime.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="locationName">Location Name</Label>
        <Input
          id="locationName"
          value={locationName}
          onChange={(e) => {
            setLocationName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g., Sydney"
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locationState">State</Label>
        <Input
          id="locationState"
          value={locationState}
          onChange={(e) => {
            setLocationState(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g., NSW"
          disabled={isSubmitting}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? isRequestMode ? "Submitting..." : "Creating..."
            : isRequestMode ? "Submit Request" : "Create Location"}
        </Button>
        <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AddLocationDialog({
  open,
  onOpenChange,
  onLocationAdded,
  onLocationRequested,
  userRole,
}: AddLocationDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isRequestMode = userRole !== "Admin";

  const title = isRequestMode ? "Request New Location" : "Add New Location";
  const description = isRequestMode
    ? "Request a new location for admin approval."
    : "Create a new location that will be available for selection.";

  const handleClose = () => onOpenChange(false);

  const form = (className?: string) => (
    <LocationForm
      onLocationAdded={onLocationAdded}
      onLocationRequested={onLocationRequested}
      onClose={handleClose}
      isRequestMode={isRequestMode}
      className={className}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">{form()}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {form("px-4")}
      </DrawerContent>
    </Drawer>
  );
}
