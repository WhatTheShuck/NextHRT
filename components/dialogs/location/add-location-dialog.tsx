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
import { Location } from "@/generated/prisma_client/client";

interface AddLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationAdded?: (location: Location) => void;
}

interface LocationFormProps {
  onLocationAdded?: (location: Location) => void;
  onClose: () => void;
  className?: string;
}

function LocationForm({ onLocationAdded, onClose, className }: LocationFormProps) {
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setLocationName("");
    setLocationState("");
  };

  const handleCreate = async () => {
    if (!locationName.trim() || !locationState.trim()) {
      alert("Please enter both location name and state");
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post<Location>("/api/locations", {
        name: locationName,
        state: locationState,
      });

      onLocationAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating location:", err);
      alert(err.response?.data?.error || "Failed to create location");
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
        <Label htmlFor="locationName">Location Name</Label>
        <Input
          id="locationName"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="e.g., Sydney"
          disabled={isCreating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locationState">State</Label>
        <Input
          id="locationState"
          value={locationState}
          onChange={(e) => setLocationState(e.target.value)}
          placeholder="e.g., NSW"
          disabled={isCreating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Location"}
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

export function AddLocationDialog({
  open,
  onOpenChange,
  onLocationAdded,
}: AddLocationDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Create a new location that will be available for selection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <LocationForm onLocationAdded={onLocationAdded} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Location</DrawerTitle>
          <DrawerDescription>
            Create a new location that will be available for selection.
          </DrawerDescription>
        </DrawerHeader>
        <LocationForm
          className="px-4"
          onLocationAdded={onLocationAdded}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
