"use client";

import { useState } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import {
  TrainingRecordsWithRelations,
  EmployeeWithRelations,
} from "@/lib/types";

interface DeleteTrainingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingRecord: TrainingRecordsWithRelations | null;
  onTrainingRecordDeleted?: () => void;
  employee?: EmployeeWithRelations | null; // Optional employee data
}

export function DeleteTrainingRecordDialog({
  open,
  onOpenChange,
  trainingRecord,
  onTrainingRecordDeleted,
  employee,
}: DeleteTrainingRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!trainingRecord) {
      alert("No training record selected");
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/api/training-records/${trainingRecord.id}`);

      onTrainingRecordDeleted?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting training record:", err);
      alert(err.response?.data?.error || "Failed to delete training record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle className="text-destructive">
              Delete Training Record
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This action cannot be undone. Are you sure you want to permanently
            delete the training record &quot;{trainingRecord?.training?.title}
            &quot;
            {employee ? ` for ${employee.firstName} ${employee.lastName}` : ""}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Warning</p>
                <p className="text-sm text-muted-foreground">
                  Deleting this training record will permanently remove it from
                  the system. This action cannot be reversed.
                </p>
              </div>
            </div>
          </div>
          {trainingRecord && (
            <div className="space-y-2">
              <Label>Training record to be deleted:</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{trainingRecord.training?.title}</p>
                <p className="text-sm text-muted-foreground">
                  Category: {trainingRecord.training?.category}
                </p>
                {trainingRecord.trainer && (
                  <p className="text-sm text-muted-foreground">
                    Trainer: {trainingRecord.trainer}
                  </p>
                )}
                {employee && (
                  <p className="text-sm text-muted-foreground">
                    Employee: {employee.firstName} {employee.lastName}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Training Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
