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
import { Plus, Eye, FileImage, Edit, Trash, Archive } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { authClient } from "@/lib/auth-client";

export function TicketTab() {
  const { employee, addTicketRecord, updateTicketRecord, deleteTicketRecord } = useEmployee();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";
  const allTicketRecords = useEmployeeTicketRecords();
  const [includeExpired, setIncludeExpired] = useState(false);
  const isExpired = (record: TicketRecordsWithRelations) =>
    !!record.expiryDate && new Date(record.expiryDate) < new Date();
  const expiredCount = allTicketRecords.filter(isExpired).length;
  const ticketRecords = includeExpired
    ? allTicketRecords
    : allTicketRecords.filter((record) => !isExpired(record));
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

  const handleAddSuccess = (record: TicketRecordsWithRelations) => {
    setIsAddSheetOpen(false);
    addTicketRecord(record);
  };

  const handleEditSuccess = (record: TicketRecordsWithRelations) => {
    setIsEditSheetOpen(false);
    setEditingRecord(null);
    updateTicketRecord(record);
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

    if (expiryDate < now) return "Expired";

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (expiryDate <= thirtyDaysFromNow) return "Expiring Soon";

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket Records</CardTitle>
              <CardDescription>
                Showing {ticketRecords.length} ticket record
                {ticketRecords.length !== 1 ? "s" : ""}
                {!includeExpired && expiredCount > 0
                  ? ` (${expiredCount} expired hidden)`
                  : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {expiredCount > 0 && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-expired-tickets"
                    checked={includeExpired}
                    onCheckedChange={setIncludeExpired}
                  />
                  <Label
                    htmlFor="include-expired-tickets"
                    className="flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Include expired
                  </Label>
                </div>
              )}
            {isAdmin && (
              <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ticket
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add Ticket</SheetTitle>
                  </SheetHeader>
                  <TicketAddForm onSuccess={handleAddSuccess} />
                </SheetContent>
              </Sheet>
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ticketRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ticket records found
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {ticketRecords.map((record: TicketRecordsWithRelations) => {
                  const status = getTicketStatus(record);
                  return (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight">
                          {record.ticket?.ticketName}
                        </p>
                        <Badge
                          variant={getStatusVariant(status)}
                          className="shrink-0"
                        >
                          {status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {record.ticket?.ticketCode && (
                          <p>
                            <span className="font-medium text-foreground">
                              Code:
                            </span>{" "}
                            {record.ticket.ticketCode}
                          </p>
                        )}
                        <p>
                          <span className="font-medium text-foreground">
                            Issued:
                          </span>{" "}
                          {format(new Date(record.dateIssued), "PP")}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            Expires:
                          </span>{" "}
                          {record.expiryDate
                            ? format(new Date(record.expiryDate), "PP")
                            : "N/A"}
                        </p>
                        {record.licenseNumber && (
                          <p>
                            <span className="font-medium text-foreground">
                              Licence:
                            </span>{" "}
                            {record.licenseNumber}
                          </p>
                        )}
                        {record.images && record.images.length > 0 && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <FileImage className="h-4 w-4" />
                            <span>
                              {record.images.length} image
                              {record.images.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(record)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditRecord(record)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteRecord(record)}
                            >
                              <Trash className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
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
                    {ticketRecords.map((record: TicketRecordsWithRelations) => {
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
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
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
              onSuccess={handleEditSuccess}
            />
          )}
        </SheetContent>
      </Sheet>

      <TicketRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
      <DeleteTicketRecordDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        ticketRecord={deletingRecord}
        employee={employee}
        onTicketRecordDeleted={() => {
          if (deletingRecord) deleteTicketRecord(deletingRecord.id);
          setDeletingRecord(null);
          setIsDeleteDialogOpen(false);
        }}
      />
    </>
  );
}
