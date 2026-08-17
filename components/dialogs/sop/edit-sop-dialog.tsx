"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { RevisionsSection } from "@/components/dialogs/training/revisions-section";
import { SopPairSection } from "@/components/dialogs/sop/sop-pair-section";
import { SopSummary } from "@/lib/services/sopService";

interface EditSopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sop: SopSummary | null;
  onSopUpdated: (sop: SopSummary) => void;
}

function EditSopForm({
  sop,
  onSopUpdated,
  onClose,
  className,
}: {
  sop: SopSummary;
  onSopUpdated: (sop: SopSummary) => void;
  onClose: () => void;
  className?: string;
}) {
  const [title, setTitle] = useState(sop.title);
  const [isActive, setIsActive] = useState(sop.isActive);
  const [requiresRetrainingOnRevision, setRequiresRetrainingOnRevision] =
    useState(sop.requiresRetrainingOnRevision);
  const [requirements, setRequirements] = useState<RequirementPair[]>(
    sop.requirements.map((req) => ({
      id: `${req.departmentId}-${req.locationId}`,
      departmentId: req.departmentId,
      locationId: req.locationId,
      departmentName: req.departmentName,
      locationName: req.locationName,
    })),
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedRequirements, setHasUnsavedRequirements] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  // Revisions are edited in place; the content section re-reads them on change.
  const [revisionsToken, setRevisionsToken] = useState(0);

  useEffect(() => {
    setTitle(sop.title);
    setIsActive(sop.isActive);
    setRequiresRetrainingOnRevision(sop.requiresRetrainingOnRevision);
    setRequirements(
      sop.requirements.map((req) => ({
        id: `${req.departmentId}-${req.locationId}`,
        departmentId: req.departmentId,
        locationId: req.locationId,
        departmentName: req.departmentName,
        locationName: req.locationName,
      })),
    );
    setError("");
  }, [sop]);

  const handleRevisionsChanged = useCallback(() => {
    setRevisionsToken((token) => token + 1);
  }, []);

  const submit = async () => {
    setIsUpdating(true);
    setError("");
    try {
      const res = await api.put<SopSummary>(`/api/sops/${sop.taskSheetId}`, {
        title: title.trim(),
        isActive,
        requiresRetrainingOnRevision,
        requirements: requirements.map((req) => ({
          departmentId: req.departmentId,
          locationId: req.locationId,
        })),
      });
      onSopUpdated(res.data);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error ?? err.message ?? "Failed to update SOP",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSave = async () => {
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
      <div className={cn("space-y-4", className)}>
        {!sop.paired && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            This SOP has no linked Practical half, so it can&apos;t be saved as a
            pair. Run <code className="text-xs">scripts/backfill-sop-partners.ts</code>{" "}
            or recreate it.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="sop-name">SOP Name</Label>
          <Input
            id="sop-name"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
            placeholder="e.g., Pump Rebuild"
            disabled={isUpdating}
          />
          <p className="text-xs text-muted-foreground">
            Renaming updates both the Task Sheet and the Practical halves.
          </p>
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="sop-active" className="text-sm font-medium">
              SOP Active
            </Label>
            <p className="text-xs text-muted-foreground">
              Inactive SOPs disappear from employees&apos; My SOPs lists
            </p>
          </div>
          <Switch
            id="sop-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isUpdating}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="sop-retrain" className="text-sm font-medium">
              Requires Retraining on Revision
            </Label>
            <p className="text-xs text-muted-foreground">
              Employees must redo the SOP when a new revision becomes current
            </p>
          </div>
          <Switch
            id="sop-retrain"
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
          <p className="text-xs text-muted-foreground mt-2">
            Requirements apply to both halves of the SOP.
          </p>
        </div>

        <div className="border-t pt-4">
          <RevisionsSection
            trainingId={sop.taskSheetId}
            disabled={isUpdating}
            emptyMessage="No revisions yet. Add one to attach a procedure PDF and questions."
            onRevisionsChanged={handleRevisionsChanged}
          />
        </div>

        <SopPairSection
          trainingId={sop.taskSheetId}
          revisionsToken={revisionsToken}
        />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isUpdating || !sop.paired}
          >
            {isUpdating ? "Saving..." : "Save SOP Details"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
          >
            Close
          </Button>
        </div>
      </div>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Requirement Selection</AlertDialogTitle>
            <AlertDialogDescription>
              You have selected a department and location combination that
              hasn&apos;t been added to your requirements. Would you like to proceed
              without adding this requirement, or go back to add it?
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

export function EditSopDialog({
  open,
  onOpenChange,
  sop,
  onSopUpdated,
}: EditSopDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (!sop) return null;

  const description =
    "Details, revisions, procedure PDF, questions and trainers for this SOP.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{sop.title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <EditSopForm
              sop={sop}
              onSopUpdated={onSopUpdated}
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
          <DrawerTitle>{sop.title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">
          <EditSopForm
            className="px-4"
            sop={sop}
            onSopUpdated={onSopUpdated}
            onClose={handleClose}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
