"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ExemptionStatus,
  ExemptionType,
  Ticket,
  Training,
  TrainingTicketExemption,
} from "@/generated/prisma_client";
import { TrainingTicketExemptionWithRelations } from "@/lib/types";
import { TicketSelector } from "@/components/ticket-selector";
import { TrainingSelector } from "@/app/bulk-training/components/training-selector";
import { DateSelector } from "@/components/date-selector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface EditTrainingTicketExemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exemption: TrainingTicketExemptionWithRelations | null;
  onTrainingTicketExemptionUpdated?: (
    exemption: TrainingTicketExemption,
  ) => void;
}

interface TrainingTicketExemptionEditFormProps {
  exemption: TrainingTicketExemptionWithRelations | null;
  onTrainingTicketExemptionUpdated?: (
    exemption: TrainingTicketExemption,
  ) => void;
  onClose: () => void;
  className?: string;
  tickets: Ticket[];
  trainings: Training[];
  isLoadingData: boolean;
}

function TrainingTicketExemptionEditForm({
  exemption,
  onTrainingTicketExemptionUpdated,
  onClose,
  className,
  tickets,
  trainings,
  isLoadingData,
}: TrainingTicketExemptionEditFormProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [exemptionType, setExemptionType] = useState<ExemptionType>("Ticket");
  const [exemptionNameId, setExemptionNameId] = useState<string>("");
  const [exemptionReason, setExemptionReason] = useState<string>("");
  const [exemptionStartDate, setExemptionStartDate] = useState<Date>(
    new Date(),
  );
  const [exemptionEndDate, setExemptionEndDate] = useState<Date | null>(null);
  const [exemptionStatus, setExemptionStatus] =
    useState<ExemptionStatus>("Active");
  const [error, setError] = useState<string | null>(null);

  // Reset exemptionNameId when switching types
  useEffect(() => {
    setExemptionNameId("");
  }, [exemptionType]);

  const resetForm = () => {
    if (exemption) {
      setExemptionType(exemption.type || "Ticket");
      setExemptionNameId(
        exemption.type === "Ticket"
          ? exemption.ticketId?.toString() || ""
          : exemption.trainingId?.toString() || "",
      );
      setExemptionReason(exemption.reason || "");
      setExemptionStartDate(exemption.startDate || new Date());
      setExemptionEndDate(exemption.endDate || null);
      setExemptionStatus(exemption.status || "Active");
    }
    setError(null);
  };

  const handleUpdate = async () => {
    if (!exemptionNameId) {
      setError("Please select a " + exemptionType.toLowerCase());
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await api.put<TrainingTicketExemption>(
        `/api/exemptions/${exemption?.id}`,
        {
          employeeId: exemption?.employee?.id,
          type: exemptionType,
          trainingId:
            exemptionType === "Training" ? parseInt(exemptionNameId) : null,
          ticketId:
            exemptionType === "Ticket" ? parseInt(exemptionNameId) : null,
          reason: exemptionReason || null,
          startDate: exemptionStartDate,
          endDate: exemptionEndDate,
        },
      );

      onTrainingTicketExemptionUpdated?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error updating exemption:", err);

      if (err.response?.status === 409) {
        setError("A exemption with this name already exists");
      } else {
        setError(err.response?.data?.error || "Failed to update exemption");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const isFormDisabled = isUpdating || isLoadingData;
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label>Exemption Type</Label>
        <RadioGroup
          value={exemptionType}
          onValueChange={(val) => setExemptionType(val as ExemptionType)}
          disabled={isFormDisabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Ticket" id="ticket" />
            <Label htmlFor="ticket">Ticket</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Training" id="training" />
            <Label htmlFor="training">Training</Label>
          </div>
        </RadioGroup>
      </div>

      {exemptionType === "Ticket" ? (
        <div className="space-y-2">
          <Label htmlFor="exemption-name-id">Ticket Name</Label>
          <TicketSelector
            tickets={tickets}
            selectedTicketId={exemptionNameId}
            onTicketSelect={setExemptionNameId}
            onNewTicket={(ticket) => {
              tickets.push(ticket);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="exemption-name-id">Training Name</Label>
          <TrainingSelector
            trainings={trainings}
            selectedTrainingId={exemptionNameId}
            onTrainingSelect={setExemptionNameId}
            onNewTraining={(training) => {
              trainings.push(training);
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="exemption-reason">Reason For Exemption</Label>
        <Input
          id="exemption-reason"
          value={exemptionReason}
          onChange={(e) => {
            setExemptionReason(e.target.value);
            if (error) setError("");
          }}
          placeholder="e.g., On Probation"
          disabled={isFormDisabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exemption-start-date">Exemption Valid From Date</Label>
        <DateSelector
          selectedDate={exemptionStartDate}
          onDateSelect={setExemptionStartDate}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exemption-end-date">
          Exemption Expiry Date (Optional)
        </Label>
        <DateSelector
          selectedDate={exemptionEndDate}
          onDateSelect={setExemptionEndDate}
          optional={true}
          allowClear={true}
        />
      </div>
      <div className="space-y-2">
        <Label>Exemption Status</Label>
        <RadioGroup
          value={exemptionStatus}
          onValueChange={(val) => setExemptionStatus(val as ExemptionStatus)}
          disabled={isFormDisabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Active" id="active" />
            <Label htmlFor="active">Active</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Expired" id="expired" />
            <Label htmlFor="expired">Expired</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Revoked" id="revoked" />
            <Label htmlFor="revoked">Revoked</Label>
          </div>
        </RadioGroup>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update TrainingTicketExemption"}
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
  );
}

export function EditTrainingTicketExemptionDialog({
  open,
  onOpenChange,
  exemption,
  onTrainingTicketExemptionUpdated,
}: EditTrainingTicketExemptionDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  // Fetch data when dialog opens
  useEffect(() => {
    if (open && (tickets.length === 0 || trainings.length === 0)) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      // Fetch both tickets and trainings in parallel
      const [ticketsResponse, trainingsResponse] = await Promise.all([
        api.get<Ticket[]>("/api/tickets?activeOnly=true"),
        api.get<Training[]>("/api/training?activeOnly=true"),
      ]);

      setTickets(ticketsResponse.data);
      setTrainings(trainingsResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoadingData(false);
    }
  };
  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit TrainingTicketExemption</DialogTitle>
            <DialogDescription>
              Update the exemption name. This change will affect all employees
              assigned to this exemption.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TrainingTicketExemptionEditForm
              exemption={exemption}
              onTrainingTicketExemptionUpdated={
                onTrainingTicketExemptionUpdated
              }
              onClose={handleClose}
              tickets={tickets}
              trainings={trainings}
              isLoadingData={isLoadingData}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit TrainingTicketExemption</DrawerTitle>
          <DrawerDescription>
            Update the exemption name. This change will affect all employees
            assigned to this exemption.
          </DrawerDescription>
        </DrawerHeader>
        <TrainingTicketExemptionEditForm
          className="px-4"
          exemption={exemption}
          onTrainingTicketExemptionUpdated={onTrainingTicketExemptionUpdated}
          onClose={handleClose}
          tickets={tickets}
          trainings={trainings}
          isLoadingData={isLoadingData}
        />
      </DrawerContent>
    </Drawer>
  );
}
