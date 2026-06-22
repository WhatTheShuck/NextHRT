"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { MedicalStandard } from "@/generated/prisma_client/client";
import { Switch } from "@/components/ui/switch";

interface EditMedicalStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicalStandard: MedicalStandard | null;
  onMedicalStandardUpdated?: (medicalStandard: MedicalStandard) => void;
}

interface MedicalStandardEditFormProps {
  open: boolean;
  medicalStandard: MedicalStandard | null;
  onMedicalStandardUpdated?: (medicalStandard: MedicalStandard) => void;
  onClose: () => void;
  className?: string;
}

function MedicalStandardEditForm({
  open,
  medicalStandard,
  onMedicalStandardUpdated,
  onClose,
  className,
}: MedicalStandardEditFormProps) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [managerEmailSubject, setManagerEmailSubject] = useState("");
  const [managerEmailBody, setManagerEmailBody] = useState("");
  const [employeeEmailSubject, setEmployeeEmailSubject] = useState("");
  const [employeeEmailBody, setEmployeeEmailBody] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (open && medicalStandard) {
      setName(medicalStandard.name || "");
      setIsActive(medicalStandard.isActive ?? true);
      setManagerEmailSubject(medicalStandard.managerEmailSubject ?? "");
      setManagerEmailBody(medicalStandard.managerEmailBody ?? "");
      setEmployeeEmailSubject(medicalStandard.employeeEmailSubject ?? "");
      setEmployeeEmailBody(medicalStandard.employeeEmailBody ?? "");
    } else if (!open) {
      setName("");
      setIsActive(true);
      setManagerEmailSubject("");
      setManagerEmailBody("");
      setEmployeeEmailSubject("");
      setEmployeeEmailBody("");
    }
  }, [open, medicalStandard]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      alert("Please enter a medical standard name");
      return;
    }
    if (!medicalStandard) {
      alert("No medical standard selected");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await api.put<MedicalStandard>(
        `/api/medical-standards/${medicalStandard.id}`,
        {
          name: name.trim(),
          isActive,
          managerEmailSubject,
          managerEmailBody,
          employeeEmailSubject,
          employeeEmailBody,
        },
      );

      onMedicalStandardUpdated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error("Error updating medical standard:", err);
      alert(err.response?.data?.error || "Failed to update medical standard");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="medicalStandardName">Medical Standard Name</Label>
        <Input
          id="medicalStandardName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., KSB Standard"
          disabled={isUpdating}
        />
      </div>
      <div className="flex items-center justify-between space-x-2 py-2">
        <div className="space-y-1">
          <Label htmlFor="isActive" className="text-sm font-medium">
            Medical Standard Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Enable or disable this medical standard
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={isUpdating}
        />
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-sm font-medium">Email templates</p>
        <p className="text-xs text-muted-foreground">
          Use {"{tokens}"} to interpolate values:{" "}
          {"{preferredFirstName}"}, {"{preferredLastName}"}, {"{startDate}"},{" "}
          {"{managerName}"}, {"{department}"}, {"{location}"}. Leave the body
          blank to skip that email.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Manager email (sent on start date)
        </p>
        <div className="space-y-2">
          <Label htmlFor="managerEmailSubject">Subject</Label>
          <Input
            id="managerEmailSubject"
            value={managerEmailSubject}
            onChange={(e) => setManagerEmailSubject(e.target.value)}
            placeholder="Pre-employment medical for {preferredFirstName} {preferredLastName}"
            disabled={isUpdating}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="managerEmailBody">Body</Label>
          <Textarea
            id="managerEmailBody"
            value={managerEmailBody}
            onChange={(e) => setManagerEmailBody(e.target.value)}
            placeholder="Enter email body… (leave blank to skip this email)"
            rows={8}
            disabled={isUpdating}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Employee follow-up email (sent 3 days after start date)
        </p>
        <div className="space-y-2">
          <Label htmlFor="employeeEmailSubject">Subject</Label>
          <Input
            id="employeeEmailSubject"
            value={employeeEmailSubject}
            onChange={(e) => setEmployeeEmailSubject(e.target.value)}
            placeholder="Your pre-employment medical"
            disabled={isUpdating}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeEmailBody">Body</Label>
          <Textarea
            id="employeeEmailBody"
            value={employeeEmailBody}
            onChange={(e) => setEmployeeEmailBody(e.target.value)}
            placeholder="Enter email body… (leave blank to skip this email)"
            rows={8}
            disabled={isUpdating}
          />
        </div>
      </div>

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Medical Standard"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isUpdating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditMedicalStandardDialog({
  open,
  onOpenChange,
  medicalStandard,
  onMedicalStandardUpdated,
}: EditMedicalStandardDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Medical Standard</DialogTitle>
            <DialogDescription>
              Update the medical standard name, status, and email templates.
              Each standard can have its own email content for the manager and
              employee.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <MedicalStandardEditForm
              open={open}
              medicalStandard={medicalStandard}
              onMedicalStandardUpdated={onMedicalStandardUpdated}
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
          <DrawerTitle>Edit Medical Standard</DrawerTitle>
          <DrawerDescription>
            Update the medical standard name, status, and email templates.
          </DrawerDescription>
        </DrawerHeader>
        <MedicalStandardEditForm
          className="px-4 pb-4 overflow-y-auto"
          open={open}
          medicalStandard={medicalStandard}
          onMedicalStandardUpdated={onMedicalStandardUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
