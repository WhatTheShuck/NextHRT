"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Info, Users, MapPin } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NewTrainingDialog } from "@/components/dialogs/training/add-training-dialog";
import { useEffect, useState } from "react";
import { Training } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditTrainingDialog } from "@/components/dialogs/training/edit-training-dialog";
import { DeleteTrainingDialog } from "@/components/dialogs/training/delete-training-dialog";
import { TrainingWithRelations } from "@/lib/types";

const TrainingDirectory = () => {
  const [trainings, setTrainings] = useState<TrainingWithRelations[]>([]);
  const [isTrainingAddDialogOpen, setIsTrainingAddDialogOpen] = useState(false);
  const [isTrainingEditDialogOpen, setIsTrainingEditDialogOpen] =
    useState(false);
  const [isTrainingDeleteDialogOpen, setIsTrainingDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // First, load basic training data quickly
        const { data: trainingsRes } = await api.get<TrainingWithRelations[]>(
          "/api/training?includeRequirements=true",
        );
        setTrainings(trainingsRes);
        setIsLoading(false);

        // // Then, fetch compliance stats in the background
        // const { data: complianceData } = await api.get<{
        //   [trainingId: number]: any;
        // }>("/api/training/compliance-stats");

        // Update trainings with compliance data
        setTrainings((prev) =>
          prev.map((training) => ({
            ...training,
            // complianceStats: complianceData[training.id],
          })),
        );
      } catch (err) {
        console.error("Error fetching data:", err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTraining = (record: TrainingWithRelations) => {
    setSelectedRecord(record);
    setIsTrainingEditDialogOpen(true);
  };

  const handleDeleteTraining = (record: TrainingWithRelations) => {
    setSelectedRecord(record);
    setIsTrainingDeleteDialogOpen(true);
  };

  const RequirementsCell = ({
    training,
  }: {
    training: TrainingWithRelations;
  }) => {
    const requirementCount = training.requirements?.length || 0;

    if (requirementCount === 0) {
      return <span className="text-muted-foreground">No requirements</span>;
    }

    const requirementText = training.requirements
      ?.map(
        (req) =>
          `${req.department?.name} @ ${req.location?.name}, ${req.location?.state}`,
      )
      .join("\n");

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {requirementCount} requirement
                {requirementCount !== 1 ? "s" : ""}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="whitespace-pre-line text-sm">
              <strong>Required for:</strong>
              <br />
              {requirementText}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const ExemptionsCell = ({
    training,
  }: {
    training: TrainingWithRelations;
  }) => {
    const activeExemptions =
      training.trainingExemptions?.filter((e) => e.status === "Active") || [];
    const exemptionCount = activeExemptions.length;

    if (exemptionCount === 0) {
      return <span className="text-muted-foreground">None</span>;
    }

    const exemptionText = activeExemptions
      .map((exemption) => {
        const expiryText = exemption.endDate
          ? ` (expires ${new Date(exemption.endDate).toLocaleDateString()})`
          : " (permanent)";
        return `${exemption.employee?.firstName} ${exemption.employee?.lastName}: ${exemption.reason}${expiryText}`;
      })
      .join("\n");

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700">
                {exemptionCount} employee{exemptionCount !== 1 ? "s" : ""}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="whitespace-pre-line text-sm">
              <strong>Exempt employees:</strong>
              <br />
              {exemptionText}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const ComplianceCell = () => {
    return <span className="text-muted-foreground">TBD</span>;
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Training Management</CardTitle>
              <CardDescription>
                Manage training courses and view training records. Showing{" "}
                {trainings.length} training course
                {trainings.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsTrainingAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Training Course
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Training Records</TableHead>
                  <TableHead>Exemptions</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No training courses found
                    </TableCell>
                  </TableRow>
                ) : (
                  trainings
                    .sort((a, b) =>
                      a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1,
                    )
                    .map((record: TrainingWithRelations) => {
                      const recordCount = record._count?.trainingRecords || 0;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <RequirementsCell training={record} />
                          </TableCell>
                          <TableCell>
                            {recordCount}{" "}
                            {recordCount === 1 ? "record" : "records"}
                          </TableCell>
                          <TableCell>
                            <ExemptionsCell training={record} />
                          </TableCell>
                          <TableCell>
                            <ComplianceCell />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.isActive ? "default" : "secondary"
                              }
                              className={
                                record.isActive
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }
                            >
                              {record.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTraining(record)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTraining(record)}
                                disabled={recordCount > 0}
                                title={
                                  recordCount > 0
                                    ? "Cannot delete training course with existing training records"
                                    : "Delete training course"
                                }
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
          )}
        </CardContent>
      </Card>

      <NewTrainingDialog
        isOpen={isTrainingAddDialogOpen}
        onOpenChange={setIsTrainingAddDialogOpen}
        onTrainingCreated={(training) => {
          setTrainings([...trainings, training]);
        }}
      />

      <EditTrainingDialog
        open={isTrainingEditDialogOpen}
        onOpenChange={setIsTrainingEditDialogOpen}
        training={selectedRecord}
        onTrainingUpdated={(updatedTraining) => {
          setTrainings((prev) =>
            prev.map((training) =>
              training.id === updatedTraining.id ? updatedTraining : training,
            ),
          );
        }}
      />

      <DeleteTrainingDialog
        open={isTrainingDeleteDialogOpen}
        onOpenChange={setIsTrainingDeleteDialogOpen}
        training={selectedRecord}
        onTrainingDeleted={(deletedTraining) => {
          setTrainings((prev) =>
            prev.filter((training) => training.id !== deletedTraining.id),
          );
        }}
      />
    </div>
  );
};

export default TrainingDirectory;
