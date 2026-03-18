"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";

interface EditLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onLocationUpdated?: (location: Location) => void;
}

interface LocationEditFormProps {
  open: boolean;
  location: Location | null;
  onLocationUpdated?: (location: Location) => void;
  onClose: () => void;
  className?: string;
}

function LocationEditForm({
  open,
  location,
  onLocationUpdated,
  onClose,
  className,
}: LocationEditFormProps) {
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (open && location) {
      setLocationName(location.name || "");
      setLocationState(location.state || "");
      setIsActive(location.isActive ?? true);
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
      const response = await api.put<Location>(`/api/locations/${location.id}`, {
        name: locationName.trim(),
        state: locationState.trim(),
        isActive,
      });

      onLocationUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating location:", err);
      alert(err.response?.data?.error || "Failed to update location");
    } finally {
      setIsUpdating(false);
    }
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
          disabled={isUpdating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locationState">State</Label>
        <Input
          id="locationState"
          value={locationState}
          onChange={(e) => setLocationState(e.target.value)}
          placeholder="e.g., NSW"
          disabled={isUpdating}
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
          disabled={isUpdating}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Location"}
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

export function EditLocationDialog({
  open,
  onOpenChange,
  location,
  onLocationUpdated,
}: EditLocationDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
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
          <div className="py-4">
            <LocationEditForm
              open={open}
              location={location}
              onLocationUpdated={onLocationUpdated}
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
          <DrawerTitle>Edit Location</DrawerTitle>
          <DrawerDescription>
            Update the location name. This change will affect all employees
            assigned to this location.
          </DrawerDescription>
        </DrawerHeader>
        <LocationEditForm
          className="px-4"
          open={open}
          location={location}
          onLocationUpdated={onLocationUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
