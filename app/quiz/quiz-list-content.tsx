"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, CheckCircle2 } from "lucide-react";

interface AssignedRow {
  trainingId: number;
  title: string;
  currentRevisionId: number;
  response: { id: number; status: string; onCurrentRevision: boolean } | null;
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

export function QuizListContent() {
  const router = useRouter();
  const [rows, setRows] = useState<AssignedRow[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<AssignedRow[]>("/api/quiz-responses?view=assigned");
      setRows(res.data);
    } catch (err) {
      setError(apiError(err, "Failed to load questionnaires"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const start = async (row: AssignedRow) => {
    setBusyId(row.trainingId);
    setError("");
    try {
      const res = await api.post<{ id: number }>("/api/quiz-responses", {
        trainingId: row.trainingId,
      });
      router.push(`/quiz/${res.data.id}`);
    } catch (err) {
      setError(apiError(err, "Failed to start"));
      setBusyId(null);
    }
  };

  if (error && !rows) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6" />
        <h1 className="text-xl font-semibold">My questionnaires</h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no questionnaires assigned right now.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const r = row.response;
            const completed = r?.status === "Completed";
            const inProgress = r?.status === "InProgress";
            return (
              <Card key={row.trainingId}>
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.title}</p>
                    {completed && (
                      <span className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </span>
                    )}
                    {inProgress && !r?.onCurrentRevision && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        New version available
                      </Badge>
                    )}
                    {inProgress && r?.onCurrentRevision && (
                      <span className="text-xs text-muted-foreground">In progress</span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {inProgress ? (
                      <Button size="sm" onClick={() => router.push(`/quiz/${r!.id}`)}>
                        Resume
                      </Button>
                    ) : completed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/quiz/${r!.id}`)}
                      >
                        Review
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => start(row)}
                        disabled={busyId === row.trainingId}
                      >
                        {busyId === row.trainingId ? "Starting..." : "Start"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
