"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Training, Category } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import {
  RequirementSelector,
  RequirementPair,
} from "@/components/requirement-selector";
import { TrainingCombobox } from "@/components/combobox/training-combobox";

interface NewTrainingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTrainingCreated: (training: Training | Training[]) => void;
  defaultCategory?: Category;
}

interface TrainingFormProps {
  onTrainingCreated: (training: Training | Training[]) => void;
  onClose: () => void;
  className?: string;
  defaultCategory?: Category;
}

function TrainingForm({
  onTrainingCreated,
  onClose,
  className,
  defaultCategory,
}: TrainingFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(defaultCategory ?? "Internal");
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
    setCategory("Internal");
    setRequirements([]);
    setError("");
    setHasUnsavedRequirements(false);
    setUnsavedDetails(null);
  };

  const proceedWithSubmission = async () => {
    setShowUnsavedDialog(false);
    await submitTraining();
  };

  const submitTraining = async () => {
    setIsCreating(true);
    setError("");

    try {
      const payload: any = {
        title: title.trim(),
        category,
      };

      // Add requirements if they exist
      if (requirements.length > 0) {
        payload.requirements = requirements.map((req) => ({
          departmentId: req.departmentId,
          locationId: req.locationId,
        }));
      }

      const res = await api.post("/api/training", payload);

      const newTraining = await res.data;
      onTrainingCreated(newTraining);
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
        setError("Failed to create training. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateTraining = async () => {
    if (!title.trim()) {
      setError("Training title is required");
      return;
    }

    // Check for unsaved requirements before submitting
    if (hasUnsavedRequirements) {
      setShowUnsavedDialog(true);
      return;
    }

    await submitTraining();
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <>
      <div className={cn("space-y-6", className)}>
        <div className="space-y-2">
          <Label htmlFor="training-title">Training Title</Label>
          <Input
            id="training-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g., First Aid Training"
            disabled={isCreating}
          />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <RadioGroup
            value={category}
            onValueChange={(val) => setCategory(val as Category)}
            disabled={isCreating}
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
            onClick={handleCreateTraining}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Training"}
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

// ─── New-revision-of-existing-training form ─────────────────────────────────

interface NewRevisionFormProps {
  onClose: () => void;
  className?: string;
}

function NewRevisionForm({ onClose, className }: NewRevisionFormProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(
    null,
  );
  const [revisionLabel, setRevisionLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [overrideValue, setOverrideValue] = useState("inherit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<Training[]>("/api/training?activeOnly=true")
      .then((res) => {
        if (!cancelled) setTrainings(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load training courses");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!selectedTrainingId) {
      setError("Select a training to add a revision to");
      return;
    }
    if (!revisionLabel.trim() || !effectiveDate) {
      setError("Revision label and effective date are required");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await api.post(`/api/training/${selectedTrainingId}/revisions`, {
        revisionLabel: revisionLabel.trim(),
        effectiveDate: new Date(effectiveDate).toISOString(),
        description: description.trim() || null,
        overrideRequiresRetraining:
          overrideValue === "yes" ? true : overrideValue === "no" ? false : null,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            "Failed to add revision",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to add revision. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <TrainingCombobox
        trainings={trainings}
        selectedTrainingId={selectedTrainingId}
        onSelect={(id) => setSelectedTrainingId(id)}
        disabled={isSubmitting}
        label="Existing Training"
        placeholder="Search and select a training course..."
      />

      <div className="space-y-2">
        <Label htmlFor="new-rev-label">Revision Label</Label>
        <Input
          id="new-rev-label"
          value={revisionLabel}
          onChange={(e) => setRevisionLabel(e.target.value)}
          placeholder="e.g., 2025 Edition"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-rev-date">Effective Date</Label>
        <Input
          id="new-rev-date"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          May be a future date to pre-stage the revision.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-rev-desc">Description (optional)</Label>
        <Textarea
          id="new-rev-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What changed in this revision?"
          disabled={isSubmitting}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-rev-override">Requires Retraining</Label>
        <Select
          value={overrideValue}
          onValueChange={setOverrideValue}
          disabled={isSubmitting}
        >
          <SelectTrigger id="new-rev-override">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">
              Inherit (use the training&apos;s setting)
            </SelectItem>
            <SelectItem value="yes">Yes — require retraining</SelectItem>
            <SelectItem value="no">No — old completions still count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedTrainingId}
        >
          {isSubmitting ? "Adding..." : "Add Revision"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Create entry point: choose new type vs new revision ────────────────────

function AddTrainingContent({
  onTrainingCreated,
  onClose,
  className,
  defaultCategory,
}: TrainingFormProps) {
  const [mode, setMode] = useState<"new-type" | "new-revision">("new-type");

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Label>What are you adding?</Label>
        <RadioGroup
          value={mode}
          onValueChange={(val) =>
            setMode(val as "new-type" | "new-revision")
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new-type" id="mode-new-type" />
            <Label htmlFor="mode-new-type" className="font-normal">
              Brand-new training type
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new-revision" id="mode-new-revision" />
            <Label htmlFor="mode-new-revision" className="font-normal">
              New revision of an existing training
            </Label>
          </div>
        </RadioGroup>
      </div>

      {mode === "new-type" ? (
        <TrainingForm
          onTrainingCreated={onTrainingCreated}
          onClose={onClose}
          defaultCategory={defaultCategory}
        />
      ) : (
        <NewRevisionForm onClose={onClose} />
      )}
    </div>
  );
}

export function NewTrainingDialog({
  isOpen,
  onOpenChange,
  onTrainingCreated,
  defaultCategory,
}: NewTrainingDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Training</DialogTitle>
            <DialogDescription>
              Create a brand-new training type, or add a new revision to an
              existing training
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <AddTrainingContent
              onTrainingCreated={onTrainingCreated}
              onClose={handleClose}
              defaultCategory={defaultCategory}
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
          <DrawerTitle>Add Training</DrawerTitle>
          <DrawerDescription>
            Create a brand-new training type, or add a new revision to an
            existing training
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <AddTrainingContent
            onTrainingCreated={onTrainingCreated}
            onClose={handleClose}
            defaultCategory={defaultCategory}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
