"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { currentRevision } from "@/lib/services/trainingCompliance";
import { Pencil, Trash2, Plus } from "lucide-react";

export interface RevisionRow {
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

function RevisionDialog({
  open,
  onOpenChange,
  trainingId,
  revision,
  onSaved,
}: RevisionDialogProps) {
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
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
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

// ─── Revisions list ──────────────────────────────────────────────────────────

interface RevisionsSectionProps {
  trainingId: number;
  disabled?: boolean;
  /** Wording differs between a training type and an SOP; the mechanics don't. */
  emptyMessage?: string;
  /** Fires after every load so the parent can react to the current revision. */
  onRevisionsChanged?: (
    revisions: RevisionRow[],
    currentRevisionId: number | null,
  ) => void;
}

/**
 * Add/edit/delete revisions for one training. Shared by the training editor and
 * the SOP editor — for an SOP this is always the Task Sheet's revision history,
 * because that is the half the procedure and questions hang off.
 */
export function RevisionsSection({
  trainingId,
  disabled,
  emptyMessage = "No revisions yet. Add one to enable revision tracking.",
  onRevisionsChanged,
}: RevisionsSectionProps) {
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [editingRevision, setEditingRevision] = useState<RevisionRow | null>(null);
  const [deletingRevisionId, setDeletingRevisionId] = useState<number | null>(null);
  const [isDeletingRevision, setIsDeletingRevision] = useState(false);
  const [error, setError] = useState("");

  // Held in a ref so an inline parent callback can't retrigger the fetch.
  const notifyRef = useRef(onRevisionsChanged);
  notifyRef.current = onRevisionsChanged;

  const currentRevisionIdOf = (rows: RevisionRow[]) =>
    currentRevision(
      rows.map((r) => ({
        id: r.id,
        effectiveDate: new Date(r.effectiveDate),
        createdAt: new Date(r.createdAt),
        overrideRequiresRetraining: r.overrideRequiresRetraining,
      })),
      new Date(),
    )?.id ?? null;

  const fetchRevisions = useCallback(async () => {
    try {
      const res = await api.get<RevisionRow[]>(`/api/training/${trainingId}/revisions`);
      setRevisions(res.data);
      notifyRef.current?.(res.data, currentRevisionIdOf(res.data));
    } catch {
      // Non-fatal: revisions panel stays empty
    }
  }, [trainingId]);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  const handleDeleteRevision = async () => {
    if (!deletingRevisionId) return;
    setIsDeletingRevision(true);
    try {
      await api.delete(`/api/training/${trainingId}/revisions/${deletingRevisionId}`);
      setDeletingRevisionId(null);
      fetchRevisions();
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Failed to delete revision");
      setDeletingRevisionId(null);
    } finally {
      setIsDeletingRevision(false);
    }
  };

  const currentRevisionId = currentRevisionIdOf(revisions);

  return (
    <>
      <div className="space-y-3">
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
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Revision
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                    {rev.overrideRequiresRetraining === true && (
                      <Badge variant="secondary" className="text-xs">
                        Override: retrain
                      </Badge>
                    )}
                    {rev.overrideRequiresRetraining === false && (
                      <Badge variant="outline" className="text-xs">
                        Override: skip
                      </Badge>
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
                    disabled={disabled}
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
                    disabled={disabled}
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

      <RevisionDialog
        open={showRevisionDialog}
        onOpenChange={setShowRevisionDialog}
        trainingId={trainingId}
        revision={editingRevision}
        onSaved={fetchRevisions}
      />

      <AlertDialog
        open={deletingRevisionId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRevisionId(null);
        }}
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
    </>
  );
}
