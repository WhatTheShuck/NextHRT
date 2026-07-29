"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowLink } from "@/components/ui/row-link";
import { ListCheck } from "lucide-react";

interface CompletedRow {
  id: number;
  completedAt: string | null;
  employee: {
    id: number;
    preferredFirstName: string | null;
    legalFirstName: string;
    preferredLastName: string | null;
    legalLastName: string;
  };
  revision: {
    id: number;
    revisionLabel: string;
    trainingId: number;
    training: { id: number; title: string };
  };
}

function name(e: CompletedRow["employee"]): string {
  return `${e.preferredFirstName ?? e.legalFirstName} ${e.preferredLastName ?? e.legalLastName}`;
}

export function QuizResultsContent() {
  const [rows, setRows] = useState<CompletedRow[] | null>(null);
  const [error, setError] = useState("");
  const [trainingFilter, setTrainingFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await api.get<CompletedRow[]>("/api/quiz-responses?view=completed");
      setRows(res.data);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to load results");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trainings = useMemo(() => {
    const map = new Map<number, string>();
    (rows ?? []).forEach((r) => map.set(r.revision.trainingId, r.revision.training.title));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (trainingFilter === "all") return rows;
    return rows.filter((r) => r.revision.trainingId === Number(trainingFilter));
  }, [rows, trainingFilter]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ListCheck className="h-6 w-6" />
        <h1 className="text-xl font-semibold">Questionnaire results</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Open a person's summary before their IT intro. Nothing here is graded —
        the summary flags where a hand or a tip would help.
      </p>

      {trainings.length > 1 && (
        <div className="w-64">
          <Select value={trainingFilter} onValueChange={setTrainingFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All questionnaires</SelectItem>
              {trainings.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!rows ? (
        <Skeleton className="h-40 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No completed questionnaires yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Questionnaire</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="relative cursor-pointer">
                  <TableCell className="font-medium">
                    <RowLink
                      href={`/admin/quiz-results/${r.id}`}
                      label={name(r.employee)}
                    />
                    {name(r.employee)}
                  </TableCell>
                  <TableCell>{r.revision.training.title}</TableCell>
                  <TableCell>
                    {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
