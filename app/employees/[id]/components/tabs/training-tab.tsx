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
import { TrainingAddForm } from "../training-add-form";
import { TrainingEditForm } from "../training-edit-form";
import { TrainingRecordDetailsDialog } from "@/components/dialogs/training-record-details-dialog";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { useState } from "react";

export function TrainingTab() {
  const trainingRecords = useEmployeeTrainingRecords();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingRecordsWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<TrainingRecordsWithRelations | null>(null);

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

  const handleEditRecord = (record: TrainingRecordsWithRelations) => {
    setEditingRecord(record);
    setIsEditSheetOpen(true);
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
            <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Training
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Training</SheetTitle>
                </SheetHeader>
                <TrainingAddForm onSuccess={handleAddSheetClose} />
              </SheetContent>
            </Sheet>
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
                    No training records found
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

      {/* Add Training Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Training</SheetTitle>
          </SheetHeader>
          <TrainingAddForm onSuccess={handleAddSheetClose} />
        </SheetContent>
      </Sheet>

      {/* Edit Training Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
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
    </>
  );
}
