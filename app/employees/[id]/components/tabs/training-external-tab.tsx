"use client";

import { useEmployee, useEmployeeTrainingRecords } from "../employee-context";
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
import { TrainingAddForm } from "@/components/forms/training-add-form";
import { TrainingEditForm } from "@/components/forms/training-edit-form";
import { TrainingRecordDetailsDialog } from "@/components/dialogs/training-record/training-record-details-dialog";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { useState } from "react";
import { DeleteTrainingRecordDialog } from "@/components/dialogs/training-record/delete-training-record-dialog";
import { authClient } from "@/lib/auth-client";

export function ExternalTrainingTab() {
  const { employee, addTrainingRecord, updateTrainingRecord, deleteTrainingRecord } = useEmployee();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";
  const trainingRecords = useEmployeeTrainingRecords().filter(
    (record) => record.training?.category === "External",
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

  const handleAddSuccess = (record: TrainingRecordsWithRelations) => {
    setIsAddSheetOpen(false);
    addTrainingRecord(record);
  };

  const handleEditSuccess = (record: TrainingRecordsWithRelations) => {
    setIsEditSheetOpen(false);
    setEditingRecord(null);
    updateTrainingRecord(record);
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Training
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add Training</SheetTitle>
                  </SheetHeader>
                  <TrainingAddForm
                    onSuccess={handleAddSuccess}
                    categoryHint="External"
                  />
                </SheetContent>
              </Sheet>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trainingRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No external training records found
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {trainingRecords.map((record: TrainingRecordsWithRelations) => (
                  <div
                    key={record.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">
                        {record.training?.title}
                      </p>
                      <Badge variant="outline" className="shrink-0">
                        {record.training?.category}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium text-foreground">
                          Completed:
                        </span>{" "}
                        {format(new Date(record.dateCompleted), "PP")}
                      </p>
                      {record.trainer && (
                        <p>
                          <span className="font-medium text-foreground">
                            Trainer:
                          </span>{" "}
                          {record.trainer}
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
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
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
                    {trainingRecords.map(
                      (record: TrainingRecordsWithRelations) => (
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
                            {record.images && record.images.length > 0 ? (
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
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
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
              onSuccess={handleEditSuccess}
            />
          )}
        </SheetContent>
      </Sheet>

      <TrainingRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      <DeleteTrainingRecordDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        trainingRecord={deletingRecord}
        employee={employee}
        onTrainingRecordDeleted={() => {
          if (deletingRecord) deleteTrainingRecord(deletingRecord.id);
          setDeletingRecord(null);
          setIsDeleteDialogOpen(false);
        }}
      />
    </>
  );
}
