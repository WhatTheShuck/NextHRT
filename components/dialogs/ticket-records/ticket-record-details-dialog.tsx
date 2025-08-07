"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileImage,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { TicketRecordsWithRelations } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";

interface TicketRecordDetailsDialogProps {
  record: TicketRecordsWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketRecordDetailsDialog({
  record,
  open,
  onOpenChange,
}: TicketRecordDetailsDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Helper function to check if a file is a PDF
  const isPDF = (filename: string) => {
    return filename.toLowerCase().endsWith(".pdf");
  };

  const getTicketStatus = (record: TicketRecordsWithRelations) => {
    if (!record.expiryDate) return "No Expiry";
    const now = new Date();
    const expiryDate = new Date(record.expiryDate);

    if (expiryDate < now) {
      return "Expired";
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (expiryDate <= thirtyDaysFromNow) {
      return "Expiring Soon";
    }

    return "Valid";
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Valid":
        return "default";
      case "Expiring Soon":
        return "secondary";
      case "Expired":
        return "destructive";
      default:
        return "outline";
    }
  };

  const nextImage = () => {
    if (record?.images && record.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % record.images!.length);
    }
  };

  const previousImage = () => {
    if (record?.images && record.images.length > 0) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + record.images!.length) % record.images!.length,
      );
    }
  };

  const downloadImage = async (imagePath: string, originalName: string) => {
    try {
      const response = await fetch(`/api/images/${imagePath}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  if (!record) return null;

  const status = getTicketStatus(record);
  const hasImages = record.images && record.images.length > 0;
  const currentImage = hasImages ? record.images![currentImageIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ticket Record Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Record Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Ticket Information
                </h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium">Ticket Name:</span>{" "}
                    {record.ticket?.ticketName}
                  </div>
                  <div>
                    <span className="font-medium">Ticket Code:</span>{" "}
                    {record.ticket?.ticketCode}
                  </div>
                  <div>
                    <span className="font-medium">Renewal Period:</span>{" "}
                    {record.ticket?.renewal
                      ? `${record.ticket.renewal} years`
                      : "No renewal period"}
                  </div>
                  {record.licenseNumber && (
                    <div>
                      <span className="font-medium">License Number:</span>{" "}
                      {record.licenseNumber}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Issue Details
                </h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium">Date Issued:</span>{" "}
                    {format(new Date(record.dateIssued), "PPP")}
                  </div>
                  <div>
                    <span className="font-medium">Expires:</span>{" "}
                    {record.expiryDate
                      ? format(new Date(record.expiryDate), "PPP")
                      : "No expiry"}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Section */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Certificate/Document{" "}
                  {hasImages && `(${record.images!.length})`}
                </h3>
                <div className="mt-2">
                  {hasImages && currentImage ? (
                    <div className="space-y-3">
                      {/* Main Image Display */}
                      <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 relative">
                        {isPDF(currentImage.originalName) ? (
                          // PDF preview
                          <div className="flex flex-col items-center justify-center h-64 p-6">
                            <FileImage className="h-16 w-16 text-gray-400 mb-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                              PDF Document
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() =>
                                window.open(
                                  `/api/images/${currentImage.imagePath}`,
                                  "_blank",
                                )
                              }
                            >
                              Open PDF
                            </Button>
                          </div>
                        ) : (
                          // Image preview
                          <div className="relative">
                            <Image
                              src={`/api/images/${currentImage.imagePath}`}
                              alt={currentImage.originalName}
                              className="w-full h-auto max-h-96 object-contain"
                              width={500}
                              height={400}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const fallback =
                                  target.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.classList.remove("hidden");
                                }
                              }}
                            />
                            <div className="hidden flex-col items-center justify-center h-64 p-6">
                              <ImageIcon className="h-16 w-16 text-gray-400 mb-4" />
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                File could not be loaded
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                {currentImage.originalName}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Navigation arrows for multiple images */}
                        {record.images && record.images.length > 1 && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                              onClick={previousImage}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                              onClick={nextImage}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>

                            {/* Image counter */}
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                              <Badge variant="secondary" className="opacity-90">
                                {currentImageIndex + 1} of{" "}
                                {record.images.length}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Thumbnail strip for multiple images */}
                      {record.images && record.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {record.images.map((image, index) => (
                            <button
                              key={image.id}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                                index === currentImageIndex
                                  ? "border-blue-500"
                                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                              }`}
                            >
                              {isPDF(image.originalName) ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-sm">📄 PDF</span>
                                </div>
                              ) : (
                                <img
                                  src={`/api/images/${image.imagePath}`}
                                  alt={image.originalName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                          <span class="text-gray-400 text-xs">📄</span>
                                        </div>
                                      `;
                                    }
                                  }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `/api/images/${currentImage.imagePath}`,
                              "_blank",
                            )
                          }
                        >
                          {isPDF(currentImage.originalName)
                            ? "Open PDF"
                            : "View Full Size"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadImage(
                              currentImage.imagePath,
                              currentImage.originalName,
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>

                      {/* Current image info */}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <p className="font-medium">
                          {currentImage.originalName}
                        </p>
                        <p>
                          Uploaded:{" "}
                          {format(new Date(currentImage.uploadedAt), "PPP")}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {isPDF(currentImage.originalName)
                            ? "PDF Document"
                            : "Image File"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
                      <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">
                        No document attached
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
