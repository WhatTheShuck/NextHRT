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
import { useSession } from "next-auth/react";
import { AddDepartmentDialog } from "@/components/dialogs/department/add-department-dialog";
import { AddTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/add-exemption-dialog";
import { EditTrainingDialog } from "@/components/dialogs/training/edit-training-dialog";
import { EditTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/edit-exemption-dialog";
import { DeleteTrainingTicketExemptionDialog } from "@/components/dialogs/exemptions/delete-exemption-dialog";

export function ExemptionTab() {
  const { employee } = useEmployee();
  const exemptionRecords = useEmployeeTrainingTicketExemptions();
  const session = useSession();
  const isAdmin = session?.data?.user.role === "Admin";
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
    window.location.reload();
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
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Ticket and Training Exemptions</CardTitle>
              <CardDescription>
                Showing {exemptionRecords.length} exemption
                {exemptionRecords.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsExemptionAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Exemption
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              {exemptionRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No ticket records found
                  </TableCell>
                </TableRow>
              ) : (
                exemptionRecords.map(
                  (record: TrainingTicketExemptionWithRelations) => {
                    return (
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
                    );
                  },
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddTrainingTicketExemptionDialog
        open={isExemptionAddDialogOpen}
        onOpenChange={setIsExemptionAddDialogOpen}
        employeeId={employee?.id!}
        onTrainingTicketExemptionAdded={() => {
          window.location.reload();
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
          window.location.reload();
        }}
      />
    </>
  );
}
