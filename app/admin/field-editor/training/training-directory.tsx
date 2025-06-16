"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import { NewTrainingDialog } from "@/components/dialogs/training/add-training-dialog";
import { useEffect, useState } from "react";
import { Training } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditTrainingDialog } from "@/components/dialogs/training/edit-training-dialog";
import { DeleteTrainingDialog } from "@/components/dialogs/training/delete-training-dialog";

// Extended type to include training records count
interface TrainingWithCount extends Training {
  _count?: {
    trainingRecords: number;
  };
}

const TrainingDirectory = () => {
  const [trainings, setTrainings] = useState<TrainingWithCount[]>([]);
  const [isTrainingAddDialogOpen, setIsTrainingAddDialogOpen] = useState(false);
  const [isTrainingEditDialogOpen, setIsTrainingEditDialogOpen] =
    useState(false);
  const [isTrainingDeleteDialogOpen, setIsTrainingDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: trainingsRes } =
          await api.get<TrainingWithCount[]>("/api/training");
        setTrainings(trainingsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTraining = (record: TrainingWithCount) => {
    setSelectedRecord(record);
    setIsTrainingEditDialogOpen(true);
  };

  const handleDeleteTraining = (record: TrainingWithCount) => {
    setSelectedRecord(record);
    setIsTrainingDeleteDialogOpen(true);
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Training Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Training Records</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No training courses found
                  </TableCell>
                </TableRow>
              ) : (
                trainings.map((record: TrainingWithCount) => {
                  const recordCount = record._count?.trainingRecords || 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.title}
                      </TableCell>
                      <TableCell>{record.category}</TableCell>
                      <TableCell>
                        {recordCount} {recordCount === 1 ? "record" : "records"}
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
        </CardContent>
      </Card>
      {/* Dialogs */}
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
