"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";

interface EditLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onLocationUpdated?: (location: Location) => void;
}

export function EditLocationDialog({
  open,
  onOpenChange,
  location,
  onLocationUpdated,
}: EditLocationDialogProps) {
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  // Reset form when dialog opens/closes or location changes
  useEffect(() => {
    if (open && location) {
      setLocationName(location.name || "");
      setLocationState(location.state || "");
      setIsActive(location.isActive ?? true); // Fixed: use nullish coalescing and consistent property name
    } else if (!open) {
      setLocationName("");
      setLocationState("");
      setIsActive(true);
    }
  }, [open, location]);

  const handleUpdate = async () => {
    if (!locationName.trim()) {
      alert("Please enter a location name");
      return;
    }
    if (!locationState.trim()) {
      alert("Please enter a location state");
      return;
    }

    if (!location) {
      alert("No location selected");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await api.put<Location>(
        `/api/locations/${location.id}`,
        {
          name: locationName.trim(),
          state: locationState.trim(),
          isActive,
        },
      );

      onLocationUpdated?.(response.data);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error updating location:", err);
      alert(err.response?.data?.error || "Failed to update location");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>
            Update the location name. This change will affect all employees
            assigned to this location.
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
                  handleUpdate();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between space-x-2 py-2">
            <div className="space-y-1">
              <Label htmlFor="isActive" className="text-sm font-medium">
                Location Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable this location
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
