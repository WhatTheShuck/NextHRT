"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { AxiosError } from "axios";
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
import {
  RequirementPair,
  RequirementSelector,
} from "@/components/requirement-selector";
import { practicalTitle, taskSheetTitle } from "@/lib/sop/pairing";

interface AddSopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSopCreated: () => void;
}

function AddSopForm({
  onSopCreated,
  onClose,
  className,
}: {
  onSopCreated: () => void;
  onClose: () => void;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState<RequirementPair[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedRequirements, setHasUnsavedRequirements] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const submit = async () => {
    setIsCreating(true);
    setError("");
    try {
      await api.post("/api/training", {
        category: "SOP",
        title: title.trim(),
        requirements: requirements.map((req) => ({
          departmentId: req.departmentId,
          locationId: req.locationId,
        })),
      });
      onSopCreated();
      onClose();
      setTitle("");
      setRequirements([]);
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            "Failed to create SOP",
        );
      } else {
        setError("Failed to create SOP. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("SOP name is required");
      return;
    }
    if (hasUnsavedRequirements) {
      setShowUnsavedDialog(true);
      return;
    }
    await submit();
  };

  return (
    <>
      <div className={cn("space-y-6", className)}>
        <div className="space-y-2">
          <Label htmlFor="sop-title">SOP Name</Label>
          <Input
            id="sop-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g., Pump Rebuild"
            disabled={isCreating}
          />
          <p className="text-xs text-muted-foreground">
            Name it as people say it — HRT records the two halves as{" "}
            <span className="font-medium">{taskSheetTitle(title || "SOP name")}</span>{" "}
            and{" "}
            <span className="font-medium">{practicalTitle(title || "SOP name")}</span>
            .
          </p>
        </div>

        <div className="border-t pt-4">
          <RequirementSelector
            value={requirements}
            onChange={setRequirements}
            disabled={isCreating}
            onUnsavedChanges={setHasUnsavedRequirements}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Requirements apply to both halves of the SOP.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          After creating the SOP, open it to add a revision, upload the procedure
          PDF, write the questions and nominate trainers.
        </div>

        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create SOP"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
        </div>
      </div>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Requirement Selection</AlertDialogTitle>
            <AlertDialogDescription>
              You have selected a department and location combination that hasn&apos;t
              been added to your requirements. Would you like to proceed without
              adding this requirement, or go back to add it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back &amp; Add It</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowUnsavedDialog(false);
                await submit();
              }}
            >
              Proceed Without Adding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AddSopDialog({ open, onOpenChange, onSopCreated }: AddSopDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  const description =
    "Creates the Task Sheet and Practical halves as one linked SOP.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add SOP</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <AddSopForm onSopCreated={onSopCreated} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add SOP</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">
          <AddSopForm
            className="px-4"
            onSopCreated={onSopCreated}
            onClose={handleClose}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
