"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Category } from "@/generated/prisma_client/client";
import { Switch } from "@/components/ui/switch";
import {
  RequirementPair,
  RequirementSelector,
} from "@/components/requirement-selector";
import { TrainingWithRelations } from "@/lib/types";

interface EditTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  training: TrainingWithRelations | null;
  onTrainingUpdated?: (training: TrainingWithRelations | TrainingWithRelations[]) => void;
}

interface TrainingFormProps {
  training: TrainingWithRelations | null;
  onTrainingUpdated?: (training: TrainingWithRelations | TrainingWithRelations[]) => void;
  onClose: () => void;
  className?: string;
}

function TrainingForm({
  training,
  onTrainingUpdated,
  onClose,
  className,
}: TrainingFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [requirements, setRequirements] = useState<RequirementPair[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedRequirements, setHasUnsavedRequirements] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showSopDowngradeDialog, setShowSopDowngradeDialog] = useState(false);

  // Reset form when training changes
  useEffect(() => {
    if (training) {
      setTitle(training.title || "");
      setCategory(training.category || "Internal");
      setIsActive(training.isActive ?? true);

      // Convert TrainingRequirementWithRelations to RequirementPair
      const mappedRequirements: RequirementPair[] = (
        training.requirements || []
      ).map((req) => ({
        id: `${req.departmentId}-${req.locationId}`,
        departmentId: req.departmentId,
        locationId: req.locationId,
        departmentName: req.department?.name || "",
        locationName: req.location?.name || "",
      }));

      setRequirements(mappedRequirements);
      setError("");
    }
  }, [training]);

  const resetForm = () => {
    setTitle("");
    setCategory("Internal");
    setIsActive(true);
    setRequirements([]);
    setError("");
    setHasUnsavedRequirements(false);
  };

  const proceedWithSubmission = async () => {
    setShowUnsavedDialog(false);
    await submitUpdate();
  };

  const submitUpdate = async () => {
    if (!training) {
      setError("No training selected");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const payload: any = {
        title: title.trim(),
        category,
        isActive,
        requirements: requirements.map((req) => ({
          departmentId: req.departmentId,
          locationId: req.locationId,
        })),
      };

      const response = await api.put<TrainingWithRelations | TrainingWithRelations[]>(`/api/training/${training.id}`, payload);

      onTrainingUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating training:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to update training course",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError("Training title is required");
      return;
    }

    // SOP → non-SOP requires confirmation before proceeding
    if (training?.category === "SOP" && category !== "SOP") {
      setShowSopDowngradeDialog(true);
      return;
    }

    // Check for unsaved requirements before submitting
    if (hasUnsavedRequirements) {
      setShowUnsavedDialog(true);
      return;
    }

    await submitUpdate();
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <div className="space-y-2">
          <Label htmlFor="title">Training Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g., First Aid Training"
            disabled={isUpdating}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <RadioGroup
            value={category}
            onValueChange={(val) => {
              const newCat = val as Category;
              // Strip SOP suffix from title when switching away from SOP
              if (category === "SOP" && newCat !== "SOP") {
                setTitle((prev) => {
                  if (prev.endsWith(" - Task Sheet"))
                    return prev.slice(0, -" - Task Sheet".length);
                  if (prev.endsWith(" - Practical"))
                    return prev.slice(0, -" - Practical".length);
                  return prev;
                });
              }
              setCategory(newCat);
            }}
            disabled={isUpdating}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Internal" id="internal" />
              <Label htmlFor="internal">Internal</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="External" id="external" />
              <Label htmlFor="external">External</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="SOP" id="sop" />
              <Label htmlFor="sop">SOP</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="isActive" className="text-sm font-medium">
              Training Active
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable or disable this training course
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isUpdating}
          />
        </div>

        <div className="border-t pt-4">
          <RequirementSelector
            value={requirements}
            onChange={setRequirements}
            disabled={isUpdating}
            onUnsavedChanges={setHasUnsavedRequirements}
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
          <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Training Course"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>
        </div>
      </div>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Requirement Selection</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              You have selected a department and location combination that
              hasn't been added to your requirements. Would you like to proceed
              without adding this requirement, or go back to add it?
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

      <AlertDialog
        open={showSopDowngradeDialog}
        onOpenChange={setShowSopDowngradeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SOP Pairing</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              This training is part of an SOP pair (Task Sheet + Practical).
              Changing its category will permanently delete the paired{" "}
              <strong>
                {training?.title?.endsWith(" - Task Sheet")
                  ? "Practical"
                  : "Task Sheet"}
              </strong>{" "}
              training, along with its requirements and exemptions.
              <br />
              <br />
              This cannot be undone. The paired training must have no existing
              training records for this to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowSopDowngradeDialog(false);
                if (hasUnsavedRequirements) {
                  setShowUnsavedDialog(true);
                } else {
                  await submitUpdate();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Paired Training & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function EditTrainingDialog({
  open,
  onOpenChange,
  training,
  onTrainingUpdated,
}: EditTrainingDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Training Course</DialogTitle>
            <DialogDescription>
              Update the training course details. This change will affect all
              training records associated with this course.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TrainingForm
              training={training}
              onTrainingUpdated={onTrainingUpdated}
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
          <DrawerTitle>Edit Training Course</DrawerTitle>
          <DrawerDescription>
            Update the training course details. This change will affect all
            training records associated with this course.
          </DrawerDescription>
        </DrawerHeader>
        <TrainingForm
          className="px-4"
          training={training}
          onTrainingUpdated={onTrainingUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
