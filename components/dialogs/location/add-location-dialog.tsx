"use client";

import { useState } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Location } from "@/generated/prisma_client";

interface AddLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationAdded?: (location: Location) => void;
}

export function AddLocationDialog({
  open,
  onOpenChange,
  onLocationAdded,
}: AddLocationDialogProps) {
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
      onOpenChange(false);
      setLocationName("");
      setLocationState("");
    } catch (err: any) {
      console.error("Error creating location:", err);
      alert(err.response?.data?.error || "Failed to create location");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setLocationName("");
    setLocationState("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Location</DialogTitle>
          <DialogDescription>
            Create a new location that will be available for selection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="locationName">Location Name</Label>
            <Input
              id="locationName"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g., Sydney"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationState">State</Label>
            <Input
              id="locationState"
              value={locationState}
              onChange={(e) => setLocationState(e.target.value)}
              placeholder="e.g., NSW"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
