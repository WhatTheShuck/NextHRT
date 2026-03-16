import React from "react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
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
import { Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface RecalcContentProps {
  onAccept: () => void;
  onDecline: () => void;
  currentExpiryDate: Date | null;
  newExpiryDate: Date | null;
  oldTicketName: string;
  newTicketName: string;
  newTicketRenewal: number | null;
  className?: string;
}

function RecalcContent({
  onAccept,
  onDecline,
  currentExpiryDate,
  newExpiryDate,
  oldTicketName,
  newTicketName,
  newTicketRenewal,
  className,
}: RecalcContentProps) {
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
    <div className={cn("space-y-4", className)}>
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

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={onAccept}>Use Calculated Date</Button>
        <Button variant="outline" onClick={onDecline}>
          Keep Current Date
        </Button>
      </div>
    </div>
  );
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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Expiry Date Change Detected
            </DialogTitle>
            <DialogDescription>
              You&apos;ve changed the ticket type, which affects the expiry date
              calculation.
            </DialogDescription>
          </DialogHeader>
          <RecalcContent
            onAccept={onAccept}
            onDecline={onDecline}
            currentExpiryDate={currentExpiryDate}
            newExpiryDate={newExpiryDate}
            oldTicketName={oldTicketName}
            newTicketName={newTicketName}
            newTicketRenewal={newTicketRenewal}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Expiry Date Change Detected
          </DrawerTitle>
          <DrawerDescription>
            You&apos;ve changed the ticket type, which affects the expiry date
            calculation.
          </DrawerDescription>
        </DrawerHeader>
        <RecalcContent
          className="px-4"
          onAccept={onAccept}
          onDecline={onDecline}
          currentExpiryDate={currentExpiryDate}
          newExpiryDate={newExpiryDate}
          oldTicketName={oldTicketName}
          newTicketName={newTicketName}
          newTicketRenewal={newTicketRenewal}
        />
      </DrawerContent>
    </Drawer>
  );
}
