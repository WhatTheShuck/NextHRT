// components/TrainingCompletionTable.tsx
"use client";

import { useEffect, useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { TableColumn } from "@/lib/export-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Training, TrainingRecords, Employee } from "@prisma/client";

type TrainingWithRecords = Training & {
  TrainingRecords: (TrainingRecords & {
    personTrained: Employee;
  })[];
};

interface Props {
  trainingId: number;
}

const columns: TableColumn[] = [
  {
    header: "Employee Name",
    accessor: "employeeName",
    format: (value: string) => value,
  },
  {
    header: "Title",
    accessor: "title",
    format: (value: string) => value,
  },
  {
    header: "Department",
    accessor: "department",
    format: (value: string) => value,
  },
  {
    header: "Location",
    accessor: "location",
    format: (value: string) => value,
  },
  {
    header: "Date Completed",
    accessor: "dateCompleted",
    format: (value: string) => new Date(value).toLocaleDateString(),
  },
  {
    header: "Expiry Date",
    accessor: "expiryDate",
    format: (value: string | null) =>
      value ? new Date(value).toLocaleDateString() : "N/A",
  },
  {
    header: "Trainer",
    accessor: "trainer",
    format: (value: string) => value,
  },
];

export default function TrainingCompletionTable({ trainingId }: Props) {
  const [trainingData, setTrainingData] = useState<TrainingWithRecords | null>(
    null,
  );
  const [exportData, setExportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/training/${trainingId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch training data");
        }

        const data: TrainingWithRecords = await response.json();
        setTrainingData(data);

        // Prepare export data
        const exportRows = data.TrainingRecords.map((record) => ({
          employeeName: `${record.personTrained.firstName} ${record.personTrained.lastName}`,
          title: record.personTrained.Title,
          department: record.personTrained.Department,
          location: record.personTrained.Location,
          dateCompleted: new Date(record.dateCompleted).toLocaleDateString(),
          expiryDate: record.expiryDate
            ? new Date(record.expiryDate).toLocaleDateString()
            : "N/A",
          trainer: record.trainer,
        }));
        setExportData(exportRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (trainingId) {
      fetchData();
    }
  }, [trainingId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!trainingData || !trainingData.TrainingRecords.length) {
    return <div>No completion records found for this training.</div>;
  }

  return (
    <div className="space-y-4">
      <ExportButtons
        data={exportData}
        columns={columns}
        filename={`${trainingData.title}-completions`}
        title={`${trainingData.title} - Completion Records`}
      />

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.accessor}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainingData.TrainingRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell>
                {`${record.personTrained.firstName} ${record.personTrained.lastName}`}
              </TableCell>
              <TableCell>{record.personTrained.Title}</TableCell>
              <TableCell>{record.personTrained.Department}</TableCell>
              <TableCell>{record.personTrained.Location}</TableCell>
              <TableCell>
                {new Date(record.dateCompleted).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {record.expiryDate
                  ? new Date(record.expiryDate).toLocaleDateString()
                  : "N/A"}
              </TableCell>
              <TableCell>{record.trainer}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
