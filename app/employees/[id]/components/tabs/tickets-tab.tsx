"use client";

import { useEmployee, useEmployeeTicketRecords } from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Eye, FileImage, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TicketAddForm } from "@/components/forms/ticket-add-form";
import { TicketEditForm } from "@/components/forms/ticket-edit-form";
import { TicketRecordDetailsDialog } from "@/components/dialogs/ticket-record-details-dialog";
import { TicketRecordsWithRelations } from "@/lib/types";
import { useState } from "react";

export function TicketTab() {
  const ticketRecords = useEmployeeTicketRecords();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TicketRecordsWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<TicketRecordsWithRelations | null>(null);

  const handleAddSheetClose = () => {
    setIsAddSheetOpen(false);
    window.location.reload();
  };

  const handleEditSheetClose = () => {
    setIsEditSheetOpen(false);
    setEditingRecord(null);
    window.location.reload();
  };

  const handleViewDetails = (record: TicketRecordsWithRelations) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };

  const handleEditRecord = (record: TicketRecordsWithRelations) => {
    setEditingRecord(record);
    setIsEditSheetOpen(true);
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Ticket Records</CardTitle>
              <CardDescription>
                Showing {ticketRecords.length} ticket record
                {ticketRecords.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ticket
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Ticket</SheetTitle>
                </SheetHeader>
                <TicketAddForm onSuccess={handleAddSheetClose} />
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Ticket Code</TableHead>
                <TableHead>Date Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Licence Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ticketRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No ticket records found
                  </TableCell>
                </TableRow>
              ) : (
                ticketRecords.map((record: TicketRecordsWithRelations) => {
                  const status = getTicketStatus(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.ticket?.ticketName}
                      </TableCell>
                      <TableCell>{record.ticket?.ticketCode}</TableCell>
                      <TableCell>
                        {format(new Date(record.dateIssued), "PP")}
                      </TableCell>
                      <TableCell>
                        {record.expiryDate
                          ? format(new Date(record.expiryDate), "PP")
                          : "N/A"}
                      </TableCell>
                      <TableCell>{record.licenseNumber}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(status)}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.imagePath ? (
                          <FileImage className="h-4 w-4 text-blue-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRecord(record)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Ticket Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Ticket Record</SheetTitle>
          </SheetHeader>
          {editingRecord && (
            <TicketEditForm
              ticketRecord={editingRecord}
              onSuccess={handleEditSheetClose}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Ticket Record Details Dialog */}
      <TicketRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
