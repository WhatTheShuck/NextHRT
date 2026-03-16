"use client";

import {
  useEmployee,
  useEmployeeTrainingTicketExemptions,
} from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { TrainingTicketExemptionWithRelations } from "@/lib/types";
import { useState } from "react";
import { AddTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/add-exemption-dialog";
import { EditTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/edit-exemption-dialog";
import { DeleteTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/delete-exemption-dialog";
import { authClient } from "@/lib/auth-client";

export function ExemptionTab() {
  const { employee, refreshData } = useEmployee();
  const exemptionRecords = useEmployeeTrainingTicketExemptions();

  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";

  const [editingRecord, setEditingRecord] =
    useState<TrainingTicketExemptionWithRelations | null>(null);
  const [deletingRecord, setDeletingRecord] =
    useState<TrainingTicketExemptionWithRelations | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExemptionAddDialogOpen, setIsExemptionAddDialogOpen] =
    useState(false);
  const [isExemptionEditDialogOpen, setIsExemptionEditDialogOpen] =
    useState(false);

  const handleEditSheetClose = () => {
    setEditingRecord(null);
    refreshData();
  };

  const handleEditRecord = (record: TrainingTicketExemptionWithRelations) => {
    if (isAdmin) {
      setEditingRecord(record);
      setIsExemptionEditDialogOpen(true);
    }
  };
  const handleDeleteRecord = (record: TrainingTicketExemptionWithRelations) => {
    if (isAdmin) {
      setDeletingRecord(record);
      setIsDeleteDialogOpen(true);
    }
  };

  const getStatusVariant = (record: TrainingTicketExemptionWithRelations) => {
    switch (record.status) {
      case "Active":
        return "default";
      case "Revoked":
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
              <CardTitle>Ticket and Training Exemptions</CardTitle>
              <CardDescription>
                Showing {exemptionRecords.length} exemption
                {exemptionRecords.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsExemptionAddDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Exemption
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {exemptionRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No exemptions found
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {exemptionRecords.map(
                  (record: TrainingTicketExemptionWithRelations) => (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight">
                          {record.ticket?.ticketName || record.training?.title}
                        </p>
                        <Badge
                          variant={getStatusVariant(record)}
                          className="shrink-0"
                        >
                          {record.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="font-medium text-foreground">
                            Type:
                          </span>{" "}
                          {record.type}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            Issued:
                          </span>{" "}
                          {format(new Date(record.startDate), "PP")}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">
                            Expires:
                          </span>{" "}
                          {record.endDate
                            ? format(new Date(record.endDate), "PP")
                            : "N/A"}
                        </p>
                        {record.reason && (
                          <p>
                            <span className="font-medium text-foreground">
                              Reason:
                            </span>{" "}
                            {record.reason}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 flex-wrap pt-1">
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
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Exemption Type</TableHead>
                      <TableHead>Date Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exemptionRecords.map(
                      (record: TrainingTicketExemptionWithRelations) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.ticket?.ticketName || record.training?.title}
                          </TableCell>
                          <TableCell>{record.type}</TableCell>
                          <TableCell>
                            {format(new Date(record.startDate), "PP")}
                          </TableCell>
                          <TableCell>
                            {record.endDate
                              ? format(new Date(record.endDate), "PP")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{record.reason}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(record)}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
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
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <AddTrainingTicketExemptionDialog
        open={isExemptionAddDialogOpen}
        onOpenChange={setIsExemptionAddDialogOpen}
        employeeId={employee?.id!}
        onTrainingTicketExemptionAdded={() => {
          setIsExemptionAddDialogOpen(false);
          refreshData();
        }}
      />
      <EditTrainingTicketExemptionDialog
        open={isExemptionEditDialogOpen}
        onOpenChange={setIsExemptionEditDialogOpen}
        exemption={editingRecord}
        onTrainingTicketExemptionUpdated={() => {
          handleEditSheetClose();
        }}
      />
      <DeleteTrainingTicketExemptionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        exemption={deletingRecord}
        onTrainingTicketExemptionDeleted={() => {
          setDeletingRecord(null);
          setIsDeleteDialogOpen(false);
          refreshData();
        }}
      />
    </>
  );
}
