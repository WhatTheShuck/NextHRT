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
  ExemptionType,
  Ticket,
  Training,
  TrainingTicketExemption,
} from "@/generated/prisma_client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DateSelector } from "@/components/date-selector";
import { TicketCombobox } from "@/components/combobox/ticket-combobox";
import { TrainingCombobox } from "@/components/combobox/training-combobox";

interface AddTrainingTicketExemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrainingTicketExemptionAdded?: (exemption: TrainingTicketExemption) => void;
  employeeId: number;
}

interface TrainingTicketExemptionFormProps {
  employeeId: number;
  onTrainingTicketExemptionAdded?: (exemption: TrainingTicketExemption) => void;
  onClose: () => void;
  className?: string;
  tickets: Ticket[];
  trainings: Training[];
  isLoadingData: boolean;
}

function TrainingTicketExemptionForm({
  employeeId,
  onTrainingTicketExemptionAdded,
  onClose,
  className,
  tickets,
  trainings,
  isLoadingData,
}: TrainingTicketExemptionFormProps) {
  const [exemptionType, setExemptionType] = useState<ExemptionType>("Ticket");
  const [exemptionNameId, setExemptionNameId] = useState<string>("");
  const [exemptionReason, setExemptionReason] = useState<string>("");
  const [exemptionStartDate, setExemptionStartDate] = useState<Date>(
    new Date(),
  );
  const [exemptionEndDate, setExemptionEndDate] = useState<Date | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setExemptionType("Ticket");
    setExemptionNameId("");
    setExemptionReason("");
    setExemptionStartDate(new Date());
    setExemptionEndDate(null);
    setError(null);
  };

  const handleCreate = async () => {
    if (!exemptionNameId) {
      setError("Please select a " + exemptionType.toLowerCase());
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await api.post<TrainingTicketExemption>(
        "/api/exemptions",
        {
          employeeId: employeeId,
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

      onTrainingTicketExemptionAdded?.(response.data);
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating exemption:", err);

      if (err.response?.status === 409) {
        setError("An exemption with this name already exists");
      } else {
        setError(err.response?.data?.error || "Failed to create exemption");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const isFormDisabled = isCreating || isLoadingData;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label>Exemption Type</Label>
        <RadioGroup
          value={exemptionType}
          onValueChange={(val) => {
            setExemptionType(val as ExemptionType);
            setExemptionNameId("");
          }}
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
          <TicketCombobox
            tickets={tickets}
            selectedTicketId={exemptionNameId}
            onSelect={setExemptionNameId}
            showAddButton={true}
            label="Ticket Name"
            onNewTicket={(ticket) => {
              tickets.push(ticket);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <TrainingCombobox
            trainings={trainings}
            selectedTrainingId={exemptionNameId}
            onSelect={setExemptionNameId}
            showAddButton={true}
            label="Training Name"
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

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleCreate} disabled={isFormDisabled}>
          {isCreating
            ? "Creating..."
            : isLoadingData
              ? "Loading..."
              : "Create Exemption"}
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
  );
}

export function AddTrainingTicketExemptionDialog({
  open,
  onOpenChange,
  onTrainingTicketExemptionAdded,
  employeeId,
}: AddTrainingTicketExemptionDialogProps) {
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Exemption for Training or Tickets</DialogTitle>
            <DialogDescription>
              Create a new exemption for this employee.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <TrainingTicketExemptionForm
              employeeId={employeeId}
              onTrainingTicketExemptionAdded={onTrainingTicketExemptionAdded}
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
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add New Exemption for Training or Tickets</DrawerTitle>
          <DrawerDescription>
            Create a new exemption for this employee.
          </DrawerDescription>
        </DrawerHeader>
        <TrainingTicketExemptionForm
          className="px-4"
          employeeId={employeeId}
          onTrainingTicketExemptionAdded={onTrainingTicketExemptionAdded}
          onClose={handleClose}
          tickets={tickets}
          trainings={trainings}
          isLoadingData={isLoadingData}
        />
      </DrawerContent>
    </Drawer>
  );
}
