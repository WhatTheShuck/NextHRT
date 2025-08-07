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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [removeExistingImages, setRemoveExistingImages] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);
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
        const { data: ticketsRes } = await api.get(
          "/api/tickets?activeOnly=true",
        );
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
    const files = Array.from(e.target.files || []);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
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

    // Clear the input to allow selecting the same files again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFileErrors([]);
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleRemoveAllExistingImages = () => {
    if (ticketRecord.images) {
      const allImageIds = ticketRecord.images.map((img) => img.id);
      setRemovedImageIds((prev) => [...new Set([...prev, ...allImageIds])]);
    }
    setSelectedFiles([]);
    setFileErrors([]);
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };
  const handleRemoveExistingImage = (imageId: number) => {
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const handleRestoreExistingImage = (imageId: number) => {
    setRemovedImageIds((prev) => prev.filter((id) => id !== imageId));
  };
  const isPDF = (filename: string) => {
    return filename.toLowerCase().endsWith(".pdf");
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

      if (removedImageIds.length > 0) {
        formData.append("removedImageIds", JSON.stringify(removedImageIds));
      }

      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

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
  const hasExistingImages =
    ticketRecord.images &&
    ticketRecord.images.length > 0 &&
    !removeExistingImages;
  const willShowNewImages = selectedFiles.length > 0;
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
        <div className="space-y-2">
          <Label htmlFor="image-upload-edit">Ticket Certificate/Image</Label>
          {ticketRecord.images &&
            ticketRecord.images.length > 0 &&
            !removeExistingImages && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <FileImage className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Current Images (
                          {
                            ticketRecord.images.filter(
                              (img) => !removedImageIds.includes(img.id),
                            ).length
                          }
                          )
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Click to view individual files
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAllExistingImages}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove All
                    </Button>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {ticketRecord.images
                      .filter((img) => !removedImageIds.includes(img.id))
                      .slice(0, 6)
                      .map((image, index) => (
                        <div key={image.id} className="relative group">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/images/${image.imagePath}`,
                                "_blank",
                              )
                            }
                            className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full"
                          >
                            {isPDF(image.originalName) ? (
                              // PDF preview
                              <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                                <div className="text-red-600 dark:text-red-400 text-2xl mb-1">
                                  📄
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-400 font-medium px-1 text-center">
                                  PDF
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 px-1 text-center truncate w-full">
                                  {image.originalName.replace(".pdf", "")}
                                </div>
                              </div>
                            ) : (
                              // Image preview
                              <img
                                src={`/api/images/${image.imagePath}`}
                                alt={image.originalName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback for broken images
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                            <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
                                              <div class="text-gray-400 text-xl mb-1">📄</div>
                                              <div class="text-xs text-gray-500 px-1 text-center">
                                                ${image.originalName}
                                              </div>
                                            </div>
                                          `;
                                  }
                                }}
                              />
                            )}
                            {index === 5 &&
                              ticketRecord.images!.filter(
                                (img) => !removedImageIds.includes(img.id),
                              ).length > 6 && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-xs font-medium">
                                  +
                                  {ticketRecord.images!.filter(
                                    (img) => !removedImageIds.includes(img.id),
                                  ).length - 6}
                                </div>
                              )}
                          </button>

                          {/* Individual remove button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExistingImage(image.id);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Remove this file"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Show removed images with restore option */}
                  {removedImageIds.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                          Files marked for removal ({removedImageIds.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setRemovedImageIds([])}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Restore all
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {ticketRecord.images
                          .filter((img) => removedImageIds.includes(img.id))
                          .map((image) => (
                            <div
                              key={`removed-${image.id}`}
                              className="relative group"
                            >
                              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden opacity-50 relative">
                                {isPDF(image.originalName) ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                                    <div className="text-red-600 dark:text-red-400 text-lg">
                                      📄
                                    </div>
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                      PDF
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={`/api/images/${image.imagePath}`}
                                    alt={image.originalName}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                <div className="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center">
                                  <X className="w-4 h-4 text-red-600" />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRestoreExistingImage(image.id)
                                }
                                className="absolute -top-2 -right-2 bg-green-500 hover:bg-green-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                title="Restore this file"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* New File Upload */}
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
                      {ticketRecord.images &&
                      ticketRecord.images.length > 0 &&
                      !removeExistingImages
                        ? "Add more images"
                        : "Click to upload images"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                    {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY} each)
                  </p>
                </div>
              </label>
              <input
                id="image-upload-edit"
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
                    New Images ({selectedFiles.length})
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
                      <div className="flex items-center space-x-3 min-w-0">
                        <FileImage className="w-5 h-5 text-gray-500" />
                        <div className="flex-1 min-w-0 ">
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
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {removeExistingImages && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                All current images will be removed when you save.{" "}
                <button
                  type="button"
                  onClick={() => setRemoveExistingImages(false)}
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
