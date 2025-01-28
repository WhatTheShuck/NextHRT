"use client";

import React, { useEffect, useState } from "react";
import { Employee, Training, TrainingRecords } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, AlertTriangle } from "lucide-react";

type EmployeeWithTraining = Employee & {
  TrainingRecords: (TrainingRecords & {
    training: Training;
  })[];
};

interface Props {
  employeeId: number;
}

const EmployeeDetails: React.FC<Props> = ({ employeeId }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [trainingRecords, setTrainingRecords] = useState<
    (TrainingRecords & { training: Training })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        setLoading(true);

        const employeeResponse = await fetch(`/api/employees/${employeeId}`);
        if (!employeeResponse.ok) throw new Error("Failed to fetch employee");
        const employeeData = await employeeResponse.json();

        const trainingResponse = await fetch("/api/training-records");
        if (!trainingResponse.ok)
          throw new Error("Failed to fetch training records");
        const allTrainingRecords = await trainingResponse.json();

        const employeeTrainingRecords = allTrainingRecords.filter(
          (record: TrainingRecords) => record.employeeId === employeeId,
        );

        setEmployee(employeeData);
        setTrainingRecords(employeeTrainingRecords);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <Card className="bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>Error loading employee details: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrainingStatus = (
    record: TrainingRecords & { training: Training },
  ) => {
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

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return format(new Date(date), "PP");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>
                {employee.firstName} {employee.lastName}
              </CardTitle>
              <CardDescription>{employee.Title}</CardDescription>
            </div>
            <Badge variant={employee.IsActive ? "default" : "secondary"}>
              {employee.IsActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Work Area ID
              </dt>
              <dd className="text-sm">{employee.WorkAreaID}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Start Date
              </dt>
              <dd className="text-sm">{formatDate(employee.StartDate)}</dd>
            </div>
            {employee.FinishDate && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Finish Date
                </dt>
                <dd className="text-sm">{formatDate(employee.FinishDate)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training Records</CardTitle>
          <CardDescription>
            Showing {trainingRecords.length} training record
            {trainingRecords.length !== 1 ? "s" : ""}
          </CardDescription>
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
    </div>
  );
};

export default EmployeeDetails;
