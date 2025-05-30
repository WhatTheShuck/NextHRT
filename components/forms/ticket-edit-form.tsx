"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import { TicketSelector } from "@/components/ticket-selector";
import { DateSelector } from "@/components/date-selector";
import api from "@/lib/axios";
import { X, Upload, FileImage, Trash2, Eye } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { TicketRecordsWithRelations } from "@/lib/types";
import { Loader2 } from "lucide-react";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

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
    }
  }, [ticketRecord]);

  // Fetch available tickets
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ticketsRes } = await api.get("/api/tickets");
        setTickets(ticketsRes);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const addTicket = (newTicket: Ticket) => {
    setTickets([...tickets, newTicket]);
    setTicketId(newTicket.id.toString());
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
      // Clear the input
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    // If selecting a new file, don't remove existing image flag
    setRemoveExistingImage(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError("");
    // Clear the file input
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
    // Clear the file input
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
      // Create FormData for multipart form submission
      const formData = new FormData();
      formData.append("employeeId", ticketRecord.employeeId.toString());
      formData.append("ticketId", ticketId);
      formData.append("licenseNumber", licenceNum);
      formData.append("dateIssued", dateIssued.toISOString());

      // Handle image operations
      if (removeExistingImage) {
        formData.append("removeImage", "true");
      }

      // Add new file if selected
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      // Send PUT request to update the ticket record
      await api.put(`/api/ticket-records/${ticketRecord.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Call success callback
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-2">
        <TicketSelector
          tickets={tickets}
          selectedTicketId={ticketId}
          onTicketSelect={setTicketId}
          onNewTicket={addTicket}
        />
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
        <DateSelector selectedDate={dateIssued} onDateSelect={setDateIssued} />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload-edit">Ticket Certificate/Image</Label>

        {/* Current Image Display */}
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

        {/* File Upload Area */}
        {(!hasExistingImage || willShowNewImage) && (
          <div className="space-y-3">
            {/* File Input */}
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

            {/* File Error */}
            {fileError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {fileError}
              </div>
            )}

            {/* Selected File Display */}
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

        {/* Removed Image Notice */}
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
  );
}
