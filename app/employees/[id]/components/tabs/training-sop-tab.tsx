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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Eye,
  FileImage,
  Edit,
  Trash,
  CheckCircle,
  Circle,
  ChevronDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { useState, useMemo } from "react";
import { DeleteTrainingRecordDialog } from "@/components/dialogs/training-record/delete-training-record-dialog";
import { authClient } from "@/lib/auth-client";

interface SOPGroup {
  name: string;
  taskSheet?: TrainingRecordsWithRelations;
  practical?: TrainingRecordsWithRelations;
}

export function SOPTrainingTab() {
  const { employee } = useEmployee();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";
  const trainingRecords = useEmployeeTrainingRecords().filter(
    (record) => record.training?.category === "SOP",
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

  // Group SOPs by name and separate task sheets from practicals
  const sopGroups = useMemo(() => {
    const groups: { [key: string]: SOPGroup } = {};

    trainingRecords.forEach((record) => {
      const title = record.training?.title || "";

      // Extract SOP name and type
      if (title.includes(" - Task Sheet")) {
        const sopName = title.replace(" - Task Sheet", "");
        if (!groups[sopName]) groups[sopName] = { name: sopName };
        groups[sopName].taskSheet = record;
      } else if (title.includes(" - Practical")) {
        const sopName = title.replace(" - Practical", "");
        if (!groups[sopName]) groups[sopName] = { name: sopName };
        groups[sopName].practical = record;
      } else {
        // Handle any SOPs that don't follow the naming convention
        if (!groups[title]) groups[title] = { name: title };
        // Could be either - check if we already have one type
        if (!groups[title].taskSheet) {
          groups[title].taskSheet = record;
        } else {
          groups[title].practical = record;
        }
      }
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [trainingRecords]);

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
    // Small delay to allow dropdown to close properly before opening dialog
    setTimeout(() => {
      setSelectedRecord(record);
      setIsDetailsOpen(true);
    }, 100);
  };

  const handleDeleteRecord = (record: TrainingRecordsWithRelations) => {
    if (isAdmin) {
      setTimeout(() => {
        setDeletingRecord(record);
        setIsDeleteDialogOpen(true);
      }, 100);
    }
  };

  const handleEditRecord = (record: TrainingRecordsWithRelations) => {
    if (isAdmin) {
      setTimeout(() => {
        setEditingRecord(record);
        setIsEditSheetOpen(true);
      }, 100);
    }
  };

  const getCompletionBadge = (
    taskSheet?: TrainingRecordsWithRelations,
    practical?: TrainingRecordsWithRelations,
  ) => {
    const hasTaskSheet = !!taskSheet;
    const hasPractical = !!practical;

    if (hasTaskSheet && hasPractical) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          Complete
        </Badge>
      );
    } else if (hasTaskSheet || hasPractical) {
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 border-amber-300"
        >
          Partial
        </Badge>
      );
    } else {
      return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getCheckboxes = (
    taskSheet?: TrainingRecordsWithRelations,
    practical?: TrainingRecordsWithRelations,
  ) => {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          {taskSheet ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Circle className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm text-muted-foreground">Task Sheet</span>
        </div>
        <div className="flex items-center space-x-1">
          {practical ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Circle className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm text-muted-foreground">Practical</span>
        </div>
      </div>
    );
  };

  const getLastCompleted = (
    taskSheet?: TrainingRecordsWithRelations,
    practical?: TrainingRecordsWithRelations,
  ) => {
    const dates = [];
    if (taskSheet) dates.push(new Date(taskSheet.dateCompleted));
    if (practical) dates.push(new Date(practical.dateCompleted));

    if (dates.length === 0) return "—";

    const latestDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    return format(latestDate, "PP");
  };

  const getTrainer = (
    taskSheet?: TrainingRecordsWithRelations,
    practical?: TrainingRecordsWithRelations,
  ) => {
    // If both exist, show both trainers if different, otherwise just one
    if (taskSheet && practical) {
      if (taskSheet.trainer === practical.trainer) {
        return taskSheet.trainer;
      }
      return `${taskSheet.trainer} / ${practical.trainer}`;
    }

    return taskSheet?.trainer || practical?.trainer || "—";
  };

  const hasImage = (
    taskSheet?: TrainingRecordsWithRelations,
    practical?: TrainingRecordsWithRelations,
  ) => {
    return !!(taskSheet?.imagePath || practical?.imagePath);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>SOP Training Records</CardTitle>
              <CardDescription>
                Showing {sopGroups.length} SOP
                {sopGroups.length !== 1 ? "s" : ""}({trainingRecords.length}{" "}
                total record{trainingRecords.length !== 1 ? "s" : ""})
              </CardDescription>
            </div>
            {isAdmin && (
              <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                <SheetTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add SOP
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add SOP</SheetTitle>
                  </SheetHeader>
                  <TrainingAddForm
                    onSuccess={handleAddSheetClose}
                    categoryHint="SOP"
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
                <TableHead>SOP Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Last Completed</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sopGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No SOPs found
                  </TableCell>
                </TableRow>
              ) : (
                sopGroups.map((group: SOPGroup) => {
                  return (
                    <TableRow key={group.name}>
                      <TableCell className="font-medium">
                        {group.name}
                      </TableCell>
                      <TableCell>
                        {getCompletionBadge(group.taskSheet, group.practical)}
                      </TableCell>
                      <TableCell>
                        {getCheckboxes(group.taskSheet, group.practical)}
                      </TableCell>
                      <TableCell>
                        {getLastCompleted(group.taskSheet, group.practical)}
                      </TableCell>
                      <TableCell>
                        {getTrainer(group.taskSheet, group.practical)}
                      </TableCell>
                      <TableCell>
                        {hasImage(group.taskSheet, group.practical) ? (
                          <FileImage className="h-4 w-4 text-blue-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {/* View Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!group.taskSheet && !group.practical}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {group.taskSheet && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleViewDetails(group.taskSheet!)
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Task Sheet
                                </DropdownMenuItem>
                              )}
                              {group.practical && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleViewDetails(group.practical!)
                                  }
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Practical
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Edit Dropdown - Only for admins */}
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    !group.taskSheet && !group.practical
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {group.taskSheet && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleEditRecord(group.taskSheet!)
                                    }
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Task Sheet
                                  </DropdownMenuItem>
                                )}
                                {group.practical && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleEditRecord(group.practical!)
                                    }
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Practical
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* Delete Dropdown - Only for admins */}
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={
                                    !group.taskSheet && !group.practical
                                  }
                                >
                                  <Trash className="h-4 w-4 mr-1" />
                                  Delete
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {group.taskSheet && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteRecord(group.taskSheet!)
                                    }
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Task Sheet
                                  </DropdownMenuItem>
                                )}
                                {group.practical && (
                                  <>
                                    {group.taskSheet && (
                                      <DropdownMenuSeparator />
                                    )}
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleDeleteRecord(group.practical!)
                                      }
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash className="h-4 w-4 mr-2" />
                                      Practical
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
