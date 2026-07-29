"use client";

import { useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDown, CheckCircle, Circle } from "lucide-react";
import { toast } from "sonner";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { RecordContent } from "./training-record-details-dialog";

export interface SopDetailsGroup {
  name: string;
  taskSheet?: TrainingRecordsWithRelations;
  practical?: TrainingRecordsWithRelations;
}

interface SopDetailsDialogProps {
  group: SopDetailsGroup | null;
  /** Set only when this SOP was completed through HRT — enables the PDF. */
  assessmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fetch and save the completion record. Shared by the SOP tab's row button and
 * the dialog so both behave identically. Throws — callers surface the message.
 */
export async function downloadCompletionRecord(
  assessmentId: number,
  sopName: string,
): Promise<void> {
  const response = await fetch(
    `/api/sop-assessments/${assessmentId}/completion-pdf`,
  );
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? "Could not build the completion record");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sop-completion-${sopName
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

function HalfSection({
  label,
  record,
}: {
  label: string;
  record?: TrainingRecordsWithRelations;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {record ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="font-semibold">{label}</h3>
        {!record && (
          <Badge variant="outline" className="text-xs">
            Not completed
          </Badge>
        )}
      </div>
      {record ? (
        <RecordContent record={record} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No {label.toLowerCase()} record for this employee yet.
        </p>
      )}
    </div>
  );
}

function SopContent({
  group,
  assessmentId,
}: {
  group: SopDetailsGroup;
  assessmentId: number | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (assessmentId === null) return;
    setDownloading(true);
    try {
      await downloadCompletionRecord(assessmentId, group.name);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not download the record",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {assessmentId !== null ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Completed in HRT</p>
            <p className="text-sm text-muted-foreground">
              Download the questions, answers, acknowledgement and trainer
              sign-off as a single PDF.
            </p>
          </div>
          <Button onClick={handleDownload} disabled={downloading}>
            <FileDown className="mr-2 h-4 w-4" />
            {downloading ? "Preparing…" : "Completion record"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Completed outside HRT — the answered questions are held with the
          original paper records.
        </p>
      )}

      <HalfSection label="Task Sheet" record={group.taskSheet} />
      <Separator />
      <HalfSection label="Practical" record={group.practical} />
    </div>
  );
}

export function SopDetailsDialog({
  group,
  assessmentId,
  open,
  onOpenChange,
}: SopDetailsDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!group) return null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{group.name}</DialogTitle>
          </DialogHeader>
          <SopContent group={group} assessmentId={assessmentId} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{group.name}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">
          <SopContent group={group} assessmentId={assessmentId} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
