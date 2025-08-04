"use client";

import { useEmployee, useEmployeeTicketRecords } from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, FileImage, Edit, Trash } from "lucide-react";
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
import { DeleteTicketRecordDialog } from "@/components/dialogs/ticket-records/delete-ticket-record-dialog";
import { TicketRecordDetailsDialog } from "@/components/dialogs/ticket-records/ticket-record-details-dialog";
import { TicketRecordsWithRelations } from "@/lib/types";
import { useState } from "react";
import { useSession } from "next-auth/react";

export function TicketTab() {
  const { employee } = useEmployee();
  const session = useSession();
  const isAdmin = session?.data?.user.role === "Admin";
  const ticketRecords = useEmployeeTicketRecords();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TicketRecordsWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<TicketRecordsWithRelations | null>(null);
  const [deletingRecord, setDeletingRecord] =
    useState<TicketRecordsWithRelations | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    if (isAdmin) {
      setEditingRecord(record);
      setIsEditSheetOpen(true);
    }
  };
  const handleDeleteRecord = (record: TicketRecordsWithRelations) => {
    if (isAdmin) {
      setDeletingRecord(record);
      setIsDeleteDialogOpen(true);
    }
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
            {isAdmin && (
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
            )}
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
                        {record.images && record.images.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <FileImage className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-600">
                              {record.images.length} image
                              {record.images.length !== 1 ? "s" : ""}
                            </span>
                          </div>
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
                            disabled={!isAdmin}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRecord(record)}
                            disabled={!isAdmin}
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Delete
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
      {/* Delete Ticket Record Dialog */}
      <DeleteTicketRecordDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        ticketRecord={deletingRecord}
        employee={employee}
        onTicketRecordDeleted={() => {
          setDeletingRecord(null);
          setIsDeleteDialogOpen(false);
          window.location.reload();
        }}
      />
    </>
  );
}
