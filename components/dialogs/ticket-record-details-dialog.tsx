"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileImage, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { TicketRecordsWithRelations } from "@/lib/types";

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

  if (!record) return null;

  const status = getTicketStatus(record);

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
                  Certificate/Document
                </h3>
                <div className="mt-2">
                  {record.imagePath ? (
                    <div className="space-y-3">
                      <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                        {record.imageType === "application/pdf" ? (
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
                                  `/api/images/${record.imagePath}`,
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
                            <img
                              src={`/api/images/${record.imagePath}`}
                              alt="Ticket certificate"
                              className="w-full h-auto max-h-96 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.classList.remove(
                                  "hidden",
                                );
                              }}
                            />
                            <div className="hidden flex-col items-center justify-center h-64 p-6">
                              <ImageIcon className="h-16 w-16 text-gray-400 mb-4" />
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Image could not be loaded
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `/api/images/${record.imagePath}`,
                              "_blank",
                            )
                          }
                        >
                          View Full Size
                        </Button>
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
