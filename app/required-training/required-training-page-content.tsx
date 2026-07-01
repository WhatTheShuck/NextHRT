"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordCompletionDialog } from "@/components/dialogs/training-record/record-completion-dialog";

interface Course {
  id: number;
  title: string;
}

interface Cell {
  trainingId: number;
  status: "done" | "outstanding" | "na";
}

interface TrackerRow {
  employee: { id: number; legalFirstName: string; legalLastName: string };
  isNewStarter: boolean;
  cells: Cell[];
}

interface TrackerData {
  courses: Course[];
  rows: TrackerRow[];
}

interface DialogState {
  employeeId: number;
  employeeName: string;
  trainingId: number;
  trainingName: string;
}

export function RequiredTrainingPageContent() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<TrackerData>("/api/required-training/delivered");
        setData(res.data);
      } catch {
        setError("Failed to load tracker. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openDialog = (row: TrackerRow, course: Course) => {
    setDialog({
      employeeId: row.employee.id,
      employeeName: `${row.employee.legalFirstName} ${row.employee.legalLastName}`,
      trainingId: course.id,
      trainingName: course.title,
    });
  };

  const handleRecorded = (employeeId: number, trainingId: number) => {
    setData((prev) => {
      if (!prev) return prev;

      const updatedRows = prev.rows.map((row) => {
        if (row.employee.id !== employeeId) return row;
        return {
          ...row,
          cells: row.cells.map((cell) =>
            cell.trainingId === trainingId
              ? { ...cell, status: "done" as const }
              : cell,
          ),
        };
      });

      const completedRow = updatedRows.find(
        (row) =>
          row.employee.id === employeeId &&
          !row.cells.some((c) => c.status === "outstanding"),
      );
      if (completedRow) {
        toast.success(
          `${completedRow.employee.legalFirstName} ${completedRow.employee.legalLastName} — all courses complete`,
        );
      }

      return {
        ...prev,
        rows: updatedRows.filter((row) =>
          row.cells.some((c) => c.status === "outstanding"),
        ),
      };
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h1 className="text-3xl font-bold">Training I Deliver</h1>
        <p className="text-muted-foreground">
          No training courses configured yet.{" "}
          <Link href="/admin/settings" className="underline text-foreground">
            Go to App Settings → Training
          </Link>{" "}
          to select the courses you personally deliver.
        </p>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h1 className="text-3xl font-bold">Training I Deliver</h1>
        <p className="text-muted-foreground">
          All caught up — no outstanding completions to record.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Training I Deliver</h1>
        <p className="text-muted-foreground mt-1">
          {data.rows.length} employee{data.rows.length !== 1 ? "s" : ""} with
          outstanding completions. Click <span className="font-mono">+</span> to
          record.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-semibold min-w-40">
                Employee
              </th>
              {data.courses.map((course) => (
                <th
                  key={course.id}
                  className="py-2 px-3 font-semibold text-center max-w-32"
                >
                  <span
                    className="block truncate"
                    title={course.title}
                  >
                    {course.title}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.employee.id} className="border-b hover:bg-muted/40">
                <td className="py-2 pr-4">
                  <span className="font-medium">
                    {row.isNewStarter && (
                      <span
                        className="mr-1 text-amber-500"
                        title="New starter"
                        aria-label="New starter"
                      >
                        ★
                      </span>
                    )}
                    {row.employee.legalFirstName} {row.employee.legalLastName}
                  </span>
                </td>
                {row.cells.map((cell) => {
                  const course = data.courses.find((c) => c.id === cell.trainingId)!;
                  return (
                    <td key={cell.trainingId} className="py-2 px-3 text-center">
                      {cell.status === "done" && (
                        <span className="text-green-600 font-bold" aria-label="Complete">
                          ✓
                        </span>
                      )}
                      {cell.status === "na" && (
                        <span className="text-muted-foreground" aria-label="Not required">
                          —
                        </span>
                      )}
                      {cell.status === "outstanding" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 font-bold"
                          aria-label={`Record ${course.title} for ${row.employee.legalFirstName} ${row.employee.legalLastName}`}
                          onClick={() => openDialog(row, course)}
                        >
                          +
                        </Button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <RecordCompletionDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          employeeId={dialog.employeeId}
          employeeName={dialog.employeeName}
          trainingId={dialog.trainingId}
          trainingName={dialog.trainingName}
          onRecorded={handleRecorded}
        />
      )}
    </div>
  );
}
