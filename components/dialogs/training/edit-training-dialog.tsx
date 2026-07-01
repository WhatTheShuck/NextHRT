"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Category } from "@/generated/prisma_client/client";
import { Switch } from "@/components/ui/switch";
import {
  RequirementPair,
  RequirementSelector,
} from "@/components/requirement-selector";
import { TrainingWithRelations } from "@/lib/types";
import { currentRevision } from "@/lib/services/trainingCompliance";
import { Pencil, Trash2, Plus } from "lucide-react";

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

interface RevisionRow {
  id: number;
  revisionLabel: string;
  effectiveDate: string;
  description: string | null;
  overrideRequiresRetraining: boolean | null;
  createdAt: string;
}

// ─── Revision add/edit dialog (responsive) ───────────────────────────────────

interface RevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingId: number;
  revision: RevisionRow | null; // null = add mode
  onSaved: () => void;
}

function RevisionDialog({ open, onOpenChange, trainingId, revision, onSaved }: RevisionDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [overrideValue, setOverrideValue] = useState("inherit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (revision) {
      setRevisionLabel(revision.revisionLabel);
      setEffectiveDate(revision.effectiveDate.slice(0, 10));
      setDescription(revision.description ?? "");
      if (revision.overrideRequiresRetraining === true) setOverrideValue("yes");
      else if (revision.overrideRequiresRetraining === false) setOverrideValue("no");
      else setOverrideValue("inherit");
    } else {
      setRevisionLabel("");
      setEffectiveDate("");
      setDescription("");
      setOverrideValue("inherit");
    }
    setError("");
  }, [open, revision]);

  const handleSubmit = async () => {
    if (!revisionLabel.trim() || !effectiveDate) {
      setError("Revision label and effective date are required");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const payload = {
        revisionLabel: revisionLabel.trim(),
        effectiveDate: new Date(effectiveDate).toISOString(),
        description: description.trim() || null,
        overrideRequiresRetraining:
          overrideValue === "yes" ? true : overrideValue === "no" ? false : null,
      };
      if (revision) {
        await api.patch(`/api/training/${trainingId}/revisions/${revision.id}`, payload);
      } else {
        await api.post(`/api/training/${trainingId}/revisions`, payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Failed to save revision");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (className?: string) => (
    <div className={cn("space-y-4 pb-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="rev-label">Revision Label</Label>
        <Input
          id="rev-label"
          value={revisionLabel}
          onChange={(e) => setRevisionLabel(e.target.value)}
          placeholder="e.g., 2025 Edition"
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rev-date">Effective Date</Label>
        <Input
          id="rev-date"
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rev-desc">Description (optional)</Label>
        <Textarea
          id="rev-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What changed in this revision?"
          disabled={isSubmitting}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rev-override">Retraining Override</Label>
        <Select value={overrideValue} onValueChange={setOverrideValue} disabled={isSubmitting}>
          <SelectTrigger id="rev-override">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Default (inherit from training type)</SelectItem>
            <SelectItem value="yes">Always require retraining</SelectItem>
            <SelectItem value="no">Never require retraining</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : revision ? "Update Revision" : "Add Revision"}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const title = revision ? "Edit Revision" : "Add Revision";
  const description_ = revision
    ? "Update this revision's details."
    : "Add a new revision to this training type.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description_}</DialogDescription>
          </DialogHeader>
          <div className="py-2">{formContent()}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description_}</DrawerDescription>
        </DrawerHeader>
        {formContent("px-4")}
      </DrawerContent>
    </Drawer>
  );
}

// ─── Main training form ───────────────────────────────────────────────────────

function TrainingForm({
  training,
  onTrainingUpdated,
  onClose,
  className,
}: TrainingFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Internal");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [requiresRetrainingOnRevision, setRequiresRetrainingOnRevision] = useState(false);
  const [requirements, setRequirements] = useState<RequirementPair[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedRequirements, setHasUnsavedRequirements] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showSopDowngradeDialog, setShowSopDowngradeDialog] = useState(false);

  // Revision management state
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [editingRevision, setEditingRevision] = useState<RevisionRow | null>(null);
  const [deletingRevisionId, setDeletingRevisionId] = useState<number | null>(null);
  const [isDeletingRevision, setIsDeletingRevision] = useState(false);

  // Reset form when training changes
  useEffect(() => {
    if (training) {
      setTitle(training.title || "");
      setCategory(training.category || "Internal");
      setIsActive(training.isActive ?? true);
      setRequiresRetrainingOnRevision(training.requiresRetrainingOnRevision ?? false);

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
      fetchRevisions(training.id);
    }
  }, [training]);

  const fetchRevisions = async (trainingId: number) => {
    try {
      const res = await api.get<RevisionRow[]>(`/api/training/${trainingId}/revisions`);
      setRevisions(res.data);
    } catch {
      // Non-fatal: revisions panel stays empty
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory("Internal");
    setIsActive(true);
    setRequiresRetrainingOnRevision(false);
    setRequirements([]);
    setError("");
    setHasUnsavedRequirements(false);
    setRevisions([]);
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
        requiresRetrainingOnRevision,
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

    if (training?.category === "SOP" && category !== "SOP") {
      setShowSopDowngradeDialog(true);
      return;
    }

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

  const handleDeleteRevision = async () => {
    if (!deletingRevisionId || !training) return;
    setIsDeletingRevision(true);
    try {
      await api.delete(`/api/training/${training.id}/revisions/${deletingRevisionId}`);
      setDeletingRevisionId(null);
      fetchRevisions(training.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Failed to delete revision");
      setDeletingRevisionId(null);
    } finally {
      setIsDeletingRevision(false);
    }
  };

  // Compute the current revision ID for badge display
  const now = new Date();
  const revisionLites = revisions.map((r) => ({
    id: r.id,
    effectiveDate: new Date(r.effectiveDate),
    createdAt: new Date(r.createdAt),
    overrideRequiresRetraining: r.overrideRequiresRetraining,
  }));
  const currentRevisionId = currentRevision(revisionLites, now)?.id ?? null;

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

        <div className="flex items-center justify-between space-x-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="requiresRetraining" className="text-sm font-medium">
              Requires Retraining on Revision
            </Label>
            <p className="text-xs text-muted-foreground">
              Employees must retrain when a new revision becomes current
            </p>
          </div>
          <Switch
            id="requiresRetraining"
            checked={requiresRetrainingOnRevision}
            onCheckedChange={setRequiresRetrainingOnRevision}
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

        {training && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Revisions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingRevision(null);
                  setShowRevisionDialog(true);
                }}
                disabled={isUpdating}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Revision
              </Button>
            </div>

            {revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No revisions yet. Add one to enable revision tracking.
              </p>
            ) : (
              <ul className="space-y-2">
                {revisions.map((rev) => (
                  <li
                    key={rev.id}
                    className="flex items-start justify-between rounded-md border p-3 text-sm"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{rev.revisionLabel}</span>
                        {rev.id === currentRevisionId && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                        {rev.overrideRequiresRetraining === true && (
                          <Badge variant="secondary" className="text-xs">Override: retrain</Badge>
                        )}
                        {rev.overrideRequiresRetraining === false && (
                          <Badge variant="outline" className="text-xs">Override: skip</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Effective {new Date(rev.effectiveDate).toLocaleDateString()}
                      </p>
                      {rev.description && (
                        <p className="text-muted-foreground text-xs truncate max-w-xs">
                          {rev.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingRevision(rev);
                          setShowRevisionDialog(true);
                        }}
                        disabled={isUpdating}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit revision</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingRevisionId(rev.id)}
                        disabled={isUpdating}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete revision</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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

      {/* Revision add/edit dialog */}
      {training && (
        <RevisionDialog
          open={showRevisionDialog}
          onOpenChange={setShowRevisionDialog}
          trainingId={training.id}
          revision={editingRevision}
          onSaved={() => fetchRevisions(training.id)}
        />
      )}

      {/* Delete revision confirmation */}
      <AlertDialog
        open={deletingRevisionId !== null}
        onOpenChange={(open) => { if (!open) setDeletingRevisionId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Revision</AlertDialogTitle>
            <AlertDialogDescription>
              This revision will be permanently removed. Revisions with stamped
              training records cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRevision}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRevision}
              disabled={isDeletingRevision}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingRevision ? "Deleting..." : "Delete Revision"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
