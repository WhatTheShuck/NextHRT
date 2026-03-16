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
import { Location } from "@/generated/prisma_client/client";

interface DeleteLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onLocationDeleted?: (location: Location) => void;
}

interface DeleteFormProps {
  location: Location | null;
  onLocationDeleted?: (location: Location) => void;
  onClose: () => void;
  className?: string;
}

function DeleteForm({ location, onLocationDeleted, onClose, className }: DeleteFormProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!location) {
      alert("No location selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/locations/${location.id}`);

      onLocationDeleted?.(location);
      onClose();
    } catch (err: any) {
      console.error("Error deleting location:", err);
      alert(err.response?.data?.error || "Failed to delete location");
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
              Deleting this location will remove it from your system permanently.
              Make sure no employees are currently assigned to this location.
            </p>
          </div>
        </div>
      </div>
      {location && (
        <div className="space-y-2">
          <Label>Location to be deleted:</Label>
          <div className="p-2 bg-muted rounded-md">
            <p className="font-medium">{location.name}</p>
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
          {isDeleting ? "Deleting..." : "Delete Location"}
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

export function DeleteLocationDialog({
  open,
  onOpenChange,
  location,
  onLocationDeleted,
}: DeleteLocationDialogProps) {
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
                Delete Location
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This action cannot be undone. Are you sure you want to permanently
              delete the location &quot;{location?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DeleteForm
              location={location}
              onLocationDeleted={onLocationDeleted}
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
              Delete Location
            </DrawerTitle>
          </div>
          <DrawerDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the location &quot;{location?.name}&quot;?
          </DrawerDescription>
        </DrawerHeader>
        <DeleteForm
          className="px-4"
          location={location}
          onLocationDeleted={onLocationDeleted}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
