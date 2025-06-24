"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import { TicketSelector } from "@/components/ticket-selector";
import { DateSelector } from "@/components/date-selector";
import { ExpiryRecalcDialog } from "@/components/dialogs/ticket-records/ticket-record-expiry-recalc-dialog";
import api from "@/lib/axios";
import { X, Upload, FileImage, Trash2, Eye, AlertCircle } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { TicketRecordsWithRelations } from "@/lib/types";
import { Loader2 } from "lucide-react";
import {
  calculateExpiryDate,
  shouldRecalculateExpiry,
  formatRenewalPeriod,
} from "@/lib/expiry-utils";

interface TicketEditFormProps {
  ticketRecord: TicketRecordsWithRelations;
  onSuccess?: () => void;
}

export function TicketEditForm({
  ticketRecord,
  onSuccess,
}: TicketEditFormProps) {
  // Form state
  const [ticketId, setTicketId] = useState("");
  const [licenceNum, setLicenceNum] = useState("");
  const [dateIssued, setDateIssued] = useState<Date>(new Date());
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  // Expiry recalculation state
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [pendingExpiryDate, setPendingExpiryDate] = useState<Date | null>(null);
  const [oldTicket, setOldTicket] = useState<Ticket | null>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string>("");

  // Data fetching state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize form with existing ticket record data
  useEffect(() => {
    if (ticketRecord) {
      setTicketId(ticketRecord.ticketId.toString());
      setLicenceNum(ticketRecord.licenseNumber || "");
      setDateIssued(new Date(ticketRecord.dateIssued));
      setExpiryDate(
        ticketRecord.expiryDate ? new Date(ticketRecord.expiryDate) : null,
      );
    }
  }, [ticketRecord]);

  // Fetch available tickets
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ticketsRes } = await api.get("/api/tickets");
        setTickets(ticketsRes);

        // Set the old ticket for comparison
        const currentTicket = ticketsRes.find(
          (t: Ticket) => t.id === ticketRecord.ticketId,
        );
        setOldTicket(currentTicket || null);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [ticketRecord.ticketId]);

  // Handle ticket change with expiry date recalculation
  const handleTicketChange = (newTicketId: string) => {
    const newTicket = tickets.find((t) => t.id.toString() === newTicketId);

    if (!newTicket || !oldTicket) {
      setTicketId(newTicketId);
      return;
    }

    // Check if we need to show expiry recalculation dialog
    const { shouldShow, newExpiryDate } = shouldRecalculateExpiry(
      oldTicket,
      newTicket,
      expiryDate,
      dateIssued,
    );

    if (shouldShow) {
      setPendingTicketId(newTicketId);
      setPendingExpiryDate(newExpiryDate);
      setShowExpiryDialog(true);
    } else {
      // No dialog needed, just update the ticket and potentially the expiry
      setTicketId(newTicketId);
      if (newExpiryDate !== null && newExpiryDate !== expiryDate) {
        setExpiryDate(newExpiryDate);
      }
      setOldTicket(newTicket);
    }
  };

  // Handle date issued change - recalculate expiry automatically
  const handleDateIssuedChange = (newDate: Date) => {
    setDateIssued(newDate);

    const currentTicket = tickets.find((t) => t.id.toString() === ticketId);
    if (currentTicket) {
      const newExpiryDate = calculateExpiryDate(newDate, currentTicket.renewal);
      setExpiryDate(newExpiryDate);
    }
  };

  // Handle expiry dialog acceptance
  const handleAcceptRecalculation = () => {
    setTicketId(pendingTicketId);
    setExpiryDate(pendingExpiryDate);
    const newTicket = tickets.find((t) => t.id.toString() === pendingTicketId);
    setOldTicket(newTicket || null);
    setShowExpiryDialog(false);
    setPendingTicketId("");
    setPendingExpiryDate(null);
  };

  // Handle expiry dialog decline
  const handleDeclineRecalculation = () => {
    setTicketId(pendingTicketId);
    // Keep current expiry date
    const newTicket = tickets.find((t) => t.id.toString() === pendingTicketId);
    setOldTicket(newTicket || null);
    setShowExpiryDialog(false);
    setPendingTicketId("");
    setPendingExpiryDate(null);
  };

  const addTicket = (newTicket: Ticket) => {
    const updatedTickets = [...tickets, newTicket];
    setTickets(updatedTickets);
    // setTicketId(newTicket.id.toString());
    setOldTicket(newTicket);

    // Calculate expiry date for the new ticket
    const newExpiryDate = calculateExpiryDate(dateIssued, newTicket.renewal);
    setExpiryDate(newExpiryDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setRemoveExistingImage(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError("");
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleRemoveExistingImage = () => {
    setRemoveExistingImage(true);
    setSelectedFile(null);
    setFileError("");
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("employeeId", ticketRecord.employeeId.toString());
      formData.append("ticketId", ticketId);
      formData.append("licenseNumber", licenceNum);
      formData.append("dateIssued", dateIssued.toISOString());
      if (expiryDate) {
        formData.append("expiryDate", expiryDate.toISOString());
      }

      if (removeExistingImage) {
        formData.append("removeImage", "true");
      }

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      await api.put(`/api/ticket-records/${ticketRecord.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onSuccess?.();
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading form...</span>
      </div>
    );
  }

  const hasExistingImage = ticketRecord.imagePath && !removeExistingImage;
  const willShowNewImage = selectedFile && !fileError;
  const currentTicket = tickets.find((t) => t.id.toString() === ticketId);
  const pendingTicket = tickets.find(
    (t) => t.id.toString() === pendingTicketId,
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 pt-6">
        <div className="space-y-2">
          <TicketSelector
            tickets={tickets}
            selectedTicketId={ticketId}
            onTicketSelect={handleTicketChange}
            onNewTicket={addTicket}
          />
          {currentTicket && (
            <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {formatRenewalPeriod(currentTicket.renewal)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="licenceNumber">Licence Number (Optional)</Label>
          <Input
            id="licenceNumber"
            placeholder="123456789"
            value={licenceNum}
            onChange={(e) => setLicenceNum(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateIssued">Date Issued</Label>
          <DateSelector
            selectedDate={dateIssued}
            onDateSelect={handleDateIssuedChange}
          />
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Changing the issue date will automatically recalculate the expiry
            date
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiryDate">Expiry Date</Label>
          <DateSelector
            selectedDate={expiryDate}
            onDateSelect={setExpiryDate}
            optional={true}
          />
          {currentTicket?.renewal === null && (
            <div className="text-xs text-green-600 dark:text-green-400">
              This ticket type never expires
            </div>
          )}
        </div>

        {/* File Upload Section - same as before */}
        <div className="space-y-2">
          <Label htmlFor="image-upload-edit">Ticket Certificate/Image</Label>

          {hasExistingImage && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileImage className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Current Image Attached
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {ticketRecord.imageType === "application/pdf"
                          ? "PDF Document"
                          : "Image File"}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `/api/images/${ticketRecord.imagePath}`,
                          "_blank",
                        )
                      }
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveExistingImage}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(!hasExistingImage || willShowNewImage) && (
            <div className="space-y-3">
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="image-upload-edit"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">
                        {hasExistingImage ? "Replace image" : "Click to upload"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                      {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY})
                    </p>
                  </div>
                </label>
                <input
                  id="image-upload-edit"
                  type="file"
                  className="hidden"
                  accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(",")}
                  onChange={handleFileChange}
                />
              </div>

              {fileError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {fileError}
                </div>
              )}

              {willShowNewImage && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileImage className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {selectedFile!.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(selectedFile!.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {removeExistingImage && !selectedFile && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                Current image will be removed when you save.{" "}
                <button
                  type="button"
                  onClick={() => setRemoveExistingImage(false)}
                  className="underline hover:no-underline"
                >
                  Undo
                </button>
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || isSubmitting || !ticketId}
        >
          {isSubmitting ? "Saving..." : "Update Ticket Record"}
        </Button>
      </form>

      {/* Expiry Recalculation Dialog */}
      <ExpiryRecalcDialog
        isOpen={showExpiryDialog}
        onClose={() => setShowExpiryDialog(false)}
        onAccept={handleAcceptRecalculation}
        onDecline={handleDeclineRecalculation}
        currentExpiryDate={expiryDate}
        newExpiryDate={pendingExpiryDate}
        oldTicketName={oldTicket?.ticketName || ""}
        newTicketName={pendingTicket?.ticketName || ""}
        newTicketRenewal={pendingTicket?.renewal || null}
      />
    </>
  );
}
