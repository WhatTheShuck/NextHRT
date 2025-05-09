// app/employees/[id]/components/tabs/training-tab.tsx
"use client";

import { useEmployee } from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
import { TrainingRecords } from "@prisma/client";

export function TrainingTab() {
  const { trainingRecords } = useEmployee();

  const getTrainingStatus = (record: TrainingRecords) => {
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

  return (
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
          <Sheet>
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
              <TrainingAddForm />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainingRecords.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                      <Badge
                        variant={
                          status === "Valid"
                            ? "default"
                            : status === "Expiring Soon"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
