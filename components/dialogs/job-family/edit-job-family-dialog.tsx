"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { JobFamily } from "@/generated/prisma_client/client";

type PrefillValue = "unset" | "true" | "false";

const PREFILL_FIELDS: { key: keyof PrefillState; label: string }[] = [
  { key: "prefillLaptop", label: "Laptop" },
  { key: "prefillIpad", label: "iPad" },
  { key: "prefillNonStandardLaptop", label: "Non-standard laptop" },
  { key: "prefillE3Licence", label: "Full Microsoft E3 licence" },
  { key: "prefillMarketingInduction", label: "Marketing induction" },
];

interface PrefillState {
  prefillLaptop: PrefillValue;
  prefillIpad: PrefillValue;
  prefillNonStandardLaptop: PrefillValue;
  prefillE3Licence: PrefillValue;
  prefillMarketingInduction: PrefillValue;
}

function boolToPrefill(v: boolean | null): PrefillValue {
  if (v === true) return "true";
  if (v === false) return "false";
  return "unset";
}

function prefillToBool(v: PrefillValue): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

interface EditJobFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobFamily: JobFamily | null;
  onJobFamilyUpdated?: (jobFamily: JobFamily) => void;
}

interface JobFamilyEditFormProps {
  open: boolean;
  jobFamily: JobFamily | null;
  onJobFamilyUpdated?: (jobFamily: JobFamily) => void;
  onClose: () => void;
  className?: string;
}

function JobFamilyEditForm({
  open,
  jobFamily,
  onJobFamilyUpdated,
  onClose,
  className,
}: JobFamilyEditFormProps) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [prefills, setPrefills] = useState<PrefillState>({
    prefillLaptop: "unset",
    prefillIpad: "unset",
    prefillNonStandardLaptop: "unset",
    prefillE3Licence: "unset",
    prefillMarketingInduction: "unset",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open && jobFamily) {
      setName(jobFamily.name || "");
      setIsActive(jobFamily.isActive ?? true);
      setPrefills({
        prefillLaptop: boolToPrefill(jobFamily.prefillLaptop ?? null),
        prefillIpad: boolToPrefill(jobFamily.prefillIpad ?? null),
        prefillNonStandardLaptop: boolToPrefill(jobFamily.prefillNonStandardLaptop ?? null),
        prefillE3Licence: boolToPrefill(jobFamily.prefillE3Licence ?? null),
        prefillMarketingInduction: boolToPrefill(jobFamily.prefillMarketingInduction ?? null),
      });
    } else if (!open) {
      setName("");
      setIsActive(true);
    }
  }, [open, jobFamily]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      alert("Please enter a job family name");
      return;
    }
    if (!jobFamily) return;

    setIsUpdating(true);
    try {
      const response = await api.put<JobFamily>(`/api/job-families/${jobFamily.id}`, {
        name: name.trim(),
        isActive,
        prefillLaptop: prefillToBool(prefills.prefillLaptop),
        prefillIpad: prefillToBool(prefills.prefillIpad),
        prefillNonStandardLaptop: prefillToBool(prefills.prefillNonStandardLaptop),
        prefillE3Licence: prefillToBool(prefills.prefillE3Licence),
        prefillMarketingInduction: prefillToBool(prefills.prefillMarketingInduction),
      });
      onJobFamilyUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating job family:", err);
      alert(err.response?.data?.message || err.response?.data?.error || "Failed to update job family");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="jobFamilyName">Job Family Name</Label>
        <Input
          id="jobFamilyName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Service Technician"
          disabled={isUpdating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleUpdate();
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label htmlFor="isActive" className="text-sm font-medium">
            Job Family Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable or disable this job family
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isUpdating}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Onboarding prefills</p>
        <p className="text-xs text-muted-foreground">
          Set how each field should be pre-filled when this job family is selected. Leave as
          &ldquo;No override&rdquo; to use the form default.
        </p>
        <div className="space-y-2 pt-1">
          {PREFILL_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label className="text-sm font-normal">{label}</Label>
              <Select
                value={prefills[key]}
                onValueChange={(v) =>
                  setPrefills((prev) => ({ ...prev, [key]: v as PrefillValue }))
                }
                disabled={isUpdating}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">No override</SelectItem>
                  <SelectItem value="true">Checked</SelectItem>
                  <SelectItem value="false">Unchecked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Job Family"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditJobFamilyDialog({
  open,
  onOpenChange,
  jobFamily,
  onJobFamilyUpdated,
}: EditJobFamilyDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job Family</DialogTitle>
            <DialogDescription>
              Update this job family&apos;s name, status, and onboarding prefills.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <JobFamilyEditForm
              open={open}
              jobFamily={jobFamily}
              onJobFamilyUpdated={onJobFamilyUpdated}
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
          <DrawerTitle>Edit Job Family</DrawerTitle>
          <DrawerDescription>
            Update this job family&apos;s name, status, and onboarding prefills.
          </DrawerDescription>
        </DrawerHeader>
        <JobFamilyEditForm
          className="px-4 pb-4 overflow-y-auto"
          open={open}
          jobFamily={jobFamily}
          onJobFamilyUpdated={onJobFamilyUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
