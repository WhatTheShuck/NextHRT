import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, AlertTriangle } from "lucide-react";

interface ExpiryRecalcDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  currentExpiryDate: Date | null;
  newExpiryDate: Date | null;
  oldTicketName: string;
  newTicketName: string;
  newTicketRenewal: number | null;
}

export function ExpiryRecalcDialog({
  isOpen,
  onClose,
  onAccept,
  onDecline,
  currentExpiryDate,
  newExpiryDate,
  oldTicketName,
  newTicketName,
  newTicketRenewal,
}: ExpiryRecalcDialogProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "No expiry";
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getExpiryDescription = (renewal: number | null) => {
    if (renewal === null) return "never expires";
    if (renewal === 1) return "expires annually";
    return `expires every ${renewal} years`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Expiry Date Change Detected
          </DialogTitle>
          <DialogDescription>
            You've changed the ticket type, which affects the expiry date
            calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg space-y-2">
            <div className="text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100">
                From: {oldTicketName}
              </div>
              <div className="font-medium text-blue-900 dark:text-blue-100">
                To: {newTicketName}
              </div>
              <div className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                New ticket {getExpiryDescription(newTicketRenewal)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Current expiry:</div>
                <div className="text-gray-600 dark:text-gray-400">
                  {formatDate(currentExpiryDate)}
                </div>
              </div>
            </div>

            <div className="text-gray-400">→</div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">Calculated expiry:</div>
                <div className="text-green-600 dark:text-green-400">
                  {formatDate(newExpiryDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            Keep Current Date
          </Button>
          <Button onClick={onAccept} className="w-full sm:w-auto">
            Use Calculated Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
