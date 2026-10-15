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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ListCheck, Pencil } from "lucide-react";

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

export interface QuestionnaireRow {
  id: number;
  title: string;
  isActive: boolean;
}

function name(e: CompletedRow["employee"]): string {
  return `${e.preferredFirstName ?? e.legalFirstName} ${e.preferredLastName ?? e.legalLastName}`;
}

export function QuizResultsContent({
  questionnaires,
}: {
  questionnaires: QuestionnaireRow[];
}) {
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

      <Card data-tour="questionnaire-list">
        <CardContent className="pt-6 space-y-3">
          <h2 className="text-sm font-medium">Questionnaires</h2>
          {questionnaires.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questionnaires set up yet.</p>
          ) : (
            <ul className="divide-y">
              {questionnaires.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="flex items-center gap-2 text-sm">
                    {q.title}
                    {!q.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </span>
                  <Button size="sm" variant="outline" asChild data-tour="questionnaire-edit">
                    <Link href={`/admin/quiz-editor/${q.id}`}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit questions
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {trainings.length > 1 && (
        <div className="w-64" data-tour="responses-filter">
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
        <Card data-tour="responses-list">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No completed questionnaires yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto" data-tour="responses-list">
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
