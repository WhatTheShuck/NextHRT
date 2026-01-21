"use client";

import { useEmployee, useEmployeeTrainingRecords } from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import { TrainingAddForm } from "@/components/forms/training-add-form";
import { TrainingEditForm } from "@/components/forms/training-edit-form";
import { TrainingRecordDetailsDialog } from "@/components/dialogs/training-record/training-record-details-dialog";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { useState } from "react";
import { DeleteTrainingRecordDialog } from "@/components/dialogs/training-record/delete-training-record-dialog";
import { authClient } from "@/lib/auth-client";

export function InternalTrainingTab() {
  const { employee } = useEmployee();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";
  const trainingRecords = useEmployeeTrainingRecords().filter(
    (record) => record.training?.category === "Internal",
  );
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingRecordsWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<TrainingRecordsWithRelations | null>(null);
  const [deletingRecord, setDeletingRecord] =
    useState<TrainingRecordsWithRelations | null>(null);
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

  const handleViewDetails = (record: TrainingRecordsWithRelations) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };
  const handleDeleteRecord = (record: TrainingRecordsWithRelations) => {
    if (isAdmin) {
      setDeletingRecord(record);
      setIsDeleteDialogOpen(true);
    }
  };
  const handleEditRecord = (record: TrainingRecordsWithRelations) => {
    if (isAdmin) {
      setEditingRecord(record);
      setIsEditSheetOpen(true);
    }
  };
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Training Records</CardTitle>
              <CardDescription>
                Showing {trainingRecords.length} training record
                {trainingRecords.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {isAdmin && (
              <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                <SheetTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Training
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add Training</SheetTitle>
                  </SheetHeader>
                  <TrainingAddForm
                    onSuccess={handleAddSheetClose}
                    categoryHint="Internal"
                  />
                </SheetContent>
              </Sheet>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No internal training records found
                  </TableCell>
                </TableRow>
              ) : (
                trainingRecords.map((record: TrainingRecordsWithRelations) => {
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.training?.title}
                      </TableCell>
                      <TableCell>{record.training?.category}</TableCell>
                      <TableCell>
                        {format(new Date(record.dateCompleted), "PP")}
                      </TableCell>
                      <TableCell>{record.trainer}</TableCell>
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

      {/* Edit Training Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Training Record</SheetTitle>
          </SheetHeader>
          {editingRecord && (
            <TrainingEditForm
              trainingRecord={editingRecord}
              onSuccess={handleEditSheetClose}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Training Record Details Dialog */}
      <TrainingRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      {/* Delete Training Record Dialog */}
      <DeleteTrainingRecordDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        trainingRecord={deletingRecord}
        employee={employee}
        onTrainingRecordDeleted={() => {
          setDeletingRecord(null);
          setIsDeleteDialogOpen(false);
          window.location.reload();
        }}
      />
    </>
  );
}
