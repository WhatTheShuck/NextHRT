"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import { useSession } from "@/lib/auth-client";
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

export interface RecordCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  employeeName: string;
  trainingId: number;
  trainingName: string;
  onRecorded: (employeeId: number, trainingId: number) => void;
}

interface FormProps {
  employeeId: number;
  employeeName: string;
  trainingId: number;
  trainingName: string;
  onRecorded: (employeeId: number, trainingId: number) => void;
  onClose: () => void;
  className?: string;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function CompletionForm({
  employeeId,
  employeeName,
  trainingId,
  trainingName,
  onRecorded,
  onClose,
  className,
}: FormProps) {
  const { data: session } = useSession();
  const [dateCompleted, setDateCompleted] = useState(todayIso());
  const [trainer, setTrainer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.name && !trainer) {
      setTrainer(session.user.name);
    }
  }, [session?.user?.name]);

  const handleSave = async () => {
    if (!dateCompleted || !trainer.trim()) {
      setError("Date and trainer name are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("employeeId", String(employeeId));
      formData.append("trainingId", String(trainingId));
      formData.append("dateCompleted", dateCompleted);
      formData.append("trainer", trainer.trim());

      await api.post("/api/training-records", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onRecorded(employeeId, trainingId);
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        setError(
          "A record already exists for this employee, course, and date. Try a different date.",
        );
      } else {
        setError(
          err?.response?.data?.error ??
            err?.message ??
            "Failed to save training record.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Employee: <span className="font-medium text-foreground">{employeeName}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Course: <span className="font-medium text-foreground">{trainingName}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date-completed">Date completed</Label>
        <Input
          id="date-completed"
          type="date"
          value={dateCompleted}
          onChange={(e) => {
            setDateCompleted(e.target.value);
            setError(null);
          }}
          disabled={saving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trainer-name">Trainer</Label>
        <Input
          id="trainer-name"
          value={trainer}
          onChange={(e) => {
            setTrainer(e.target.value);
            setError(null);
          }}
          placeholder="Your name"
          disabled={saving}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Record Completion"}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function RecordCompletionDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  trainingId,
  trainingName,
  onRecorded,
}: RecordCompletionDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  const sharedProps: FormProps = {
    employeeId,
    employeeName,
    trainingId,
    trainingName,
    onRecorded,
    onClose: handleClose,
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Training Completion</DialogTitle>
            <DialogDescription>
              Confirm the date and trainer, then save.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <CompletionForm {...sharedProps} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Record Training Completion</DrawerTitle>
          <DrawerDescription>
            Confirm the date and trainer, then save.
          </DrawerDescription>
        </DrawerHeader>
        <CompletionForm {...sharedProps} className="px-4" />
      </DrawerContent>
    </Drawer>
  );
}
