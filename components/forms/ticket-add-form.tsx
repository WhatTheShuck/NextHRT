"use client";

import { useEmployee } from "@/app/employees/[id]/components/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import { TicketSelector } from "@/components/ticket-selector";
import { DateSelector } from "@/components/date-selector";
import api from "@/lib/axios";
import {
  X,
  Upload,
  FileImage,
  AlertCircle,
  Calendar,
  Clock,
} from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { calculateExpiryDate, formatRenewalPeriod } from "@/lib/expiry-utils";

interface TicketAddFormProps {
  onSuccess?: () => void;
}

export function TicketAddForm({ onSuccess }: TicketAddFormProps) {
  const { employee } = useEmployee();

  // Form state
  const [ticketId, setTicketId] = useState("");
  const [licenceNum, setLicenceNum] = useState("");
  const [dateIssued, setDateIssued] = useState<Date>(new Date());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  // Expiry date state
  const [manualExpiryOverride, setManualExpiryOverride] = useState(false);
  const [manualExpiryDate, setManualExpiryDate] = useState<Date | null>(null);

  // Data fetching state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error handling state
  const [submitError, setSubmitError] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ticketsRes } = await api.get(
          "/api/tickets?activeOnly=true",
        );
        setTickets(ticketsRes);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get current selected ticket
  const currentTicket = tickets.find((t) => t.id.toString() === ticketId);

  // Calculate expiry date based on current selections
  const calculatedExpiryDate = currentTicket
    ? calculateExpiryDate(dateIssued, currentTicket.renewal)
    : null;

  // Determine final expiry date to use
  const finalExpiryDate = manualExpiryOverride
    ? manualExpiryDate
    : calculatedExpiryDate;

  // Initialize manual expiry date when calculated date is first available
  useEffect(() => {
    if (calculatedExpiryDate && manualExpiryDate === null) {
      setManualExpiryDate(calculatedExpiryDate);
    }
  }, [calculatedExpiryDate, manualExpiryDate]);

  const addTicket = (newTicket: Ticket) => {
    setTickets([...tickets, newTicket]);
    setTicketId(newTicket.id.toString());
  };

  const handleTicketChange = (newTicketId: string) => {
    setTicketId(newTicketId);
    // Reset manual override when changing tickets
    setManualExpiryOverride(false);
    setManualExpiryDate(null); // Reset manual date to trigger recalculation
  };

  const handleDateIssuedChange = (newDate: Date) => {
    setDateIssued(newDate);
    // Reset manual override when changing issue date
    setManualExpiryOverride(false);
    setManualExpiryDate(null); // Reset manual date to trigger recalculation
  };

  const handleManualOverrideChange = (checked: boolean) => {
    setManualExpiryOverride(checked);
    if (checked && calculatedExpiryDate) {
      // Initialize manual date with calculated date
      setManualExpiryDate(calculatedExpiryDate);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    // Add valid files to existing selection
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFileErrors(newErrors);

    // Clear the input to allow selecting the same files again if needed
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileErrors((prev) => prev.filter((_, i) => i !== index));
  };

  // Add a function to clear all files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFileErrors([]);
    const fileInput = document.getElementById(
      "image-upload",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const formData = new FormData();
      formData.append("employeeId", employee.id.toString());
      formData.append("ticketId", ticketId);
      formData.append("licenseNumber", licenceNum);
      formData.append("dateIssued", dateIssued.toISOString());

      // Add expiry date if we have one
      if (finalExpiryDate) {
        formData.append("expiryDate", finalExpiryDate.toISOString());
      }

      // Add manual override flag
      formData.append("manualExpiryOverride", manualExpiryOverride.toString());

      // Add multiple images
      selectedFiles.forEach((file, index) => {
        formData.append(`images`, file);
      });

      await api.post("/api/ticket-records", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Reset form on success
      setTicketId("");
      setLicenceNum("");
      setDateIssued(new Date());
      setSelectedFiles([]);
      setFileErrors([]);
      setManualExpiryOverride(false);
      setManualExpiryDate(null);

      const fileInput = document.getElementById(
        "image-upload",
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      onSuccess?.();
    } catch (err: any) {
      console.error("API error:", err);

      if (err.response?.status === 409) {
        setSubmitError(
          err.response.data?.details ||
            "A ticket record with the same ticket type and date issued already exists for this employee.",
        );
      } else if (err.response?.data?.error) {
        setSubmitError(err.response.data.error);
      } else if (err.message) {
        setSubmitError(`Error saving ticket record: ${err.message}`);
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "No expiry";
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      {/* Error Message Display */}
      {submitError && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">
              {submitError}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSubmitError("")}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

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
      </div>

      {/* Expiry Date Preview and Override Section */}
      {currentTicket && (
        <div className="space-y-4">
          {/* Calculated Expiry Preview */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Calculated Expiry Date
              </span>
            </div>
            <div className="text-lg font-semibold text-blue-800 dark:text-blue-200">
              {formatDate(calculatedExpiryDate)}
            </div>
            {currentTicket.renewal && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Based on {currentTicket.renewal} year
                {currentTicket.renewal !== 1 ? "s" : ""} renewal period
              </div>
            )}
          </div>

          {/* Manual Override Section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manual-expiry"
                checked={manualExpiryOverride}
                onCheckedChange={handleManualOverrideChange}
              />
              <Label htmlFor="manual-expiry" className="text-sm font-normal">
                Manually set expiry date
              </Label>
            </div>

            {manualExpiryOverride && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="manual-expiry-date">Custom Expiry Date</Label>
                <DateSelector
                  selectedDate={manualExpiryDate}
                  onDateSelect={setManualExpiryDate}
                  optional={true}
                />
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  This will override the calculated expiry date for special
                  cases
                </div>
              </div>
            )}
          </div>

          {/* Final Expiry Summary */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700 dark:text-gray-300">
              Final expiry date: <strong>{formatDate(finalExpiryDate)}</strong>
              {manualExpiryOverride && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  (manually set)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload">
          Ticket Certificate/Images (Optional)
        </Label>
        <div className="space-y-3">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                  {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY})
                </p>
              </div>
            </label>
            <input
              id="image-upload"
              type="file"
              className="hidden"
              accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
              multiple
            />
          </div>

          {fileErrors.length > 0 && (
            <div className="space-y-1">
              {fileErrors.map((error, index) => (
                <div
                  key={index}
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {error}
                </div>
              ))}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selected Images ({selectedFiles.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-128 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg min-w-0"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <FileImage className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting || !ticketId}
      >
        {isSubmitting ? "Saving..." : "Save Ticket Record"}
      </Button>
    </form>
  );
}
