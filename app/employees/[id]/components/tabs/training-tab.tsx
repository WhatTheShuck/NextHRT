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
import { Plus, Eye, FileImage } from "lucide-react";
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
import { TrainingRecordDetailsDialog } from "@/components/dialogs/training-record-details-dialog";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { useState } from "react";

export function TrainingTab() {
  const trainingRecords = useEmployeeTrainingRecords();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingRecordsWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    window.location.reload();
  };

  const handleViewDetails = (record: TrainingRecordsWithRelations) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };

  const getTrainingStatus = (record: TrainingRecordsWithRelations) => {
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
              <CardTitle>Training Records</CardTitle>
              <CardDescription>
                Showing {trainingRecords.length} training record
                {trainingRecords.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
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
                <TrainingAddForm onSuccess={handleSheetClose} />
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
                <TableHead>Expires</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Status</TableHead>
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
                trainingRecords.map((record) => {
                  const status = getTrainingStatus(record);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.training.title}
                      </TableCell>
                      <TableCell>{record.training.category}</TableCell>
                      <TableCell>
                        {format(new Date(record.dateCompleted), "PP")}
                      </TableCell>
                      <TableCell>
                        {record.expiryDate
                          ? format(new Date(record.expiryDate), "PP")
                          : "N/A"}
                      </TableCell>
                      <TableCell>{record.trainer}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(record)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Extracted Training Record Details Dialog */}
      <TrainingRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
