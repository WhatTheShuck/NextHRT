"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lightbulb } from "lucide-react";

interface Summary {
  responseId: number;
  employeeName: string;
  trainingTitle: string;
  revisionLabel: string;
  completedAt: string | null;
  gate: { prompt: string; answerLabel: string }[];
  selfAssessment: { prompt: string; ratingLabel: string }[];
  flagged: {
    prompt: string;
    pickedLabel: string;
    coachedLabel: string;
    coaching: string | null;
  }[];
  freeText: { prompt: string; value: string }[];
  coachingTopics: string[];
}

export function QuizResultDetail({ responseId }: { responseId: number }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ summary: Summary | null }>(
        `/api/quiz-responses/${responseId}`,
      );
      if (!res.data.summary) {
        setError("No summary available for this response.");
        return;
      }
      setSummary(res.data.summary);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to load summary");
    }
  }, [responseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/quiz-results")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to results
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-3xl p-4 space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/admin/quiz-results")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to results
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{summary.employeeName}</h1>
        <p className="text-sm text-muted-foreground">
          {summary.trainingTitle} · {summary.revisionLabel}
          {summary.completedAt
            ? ` · completed ${new Date(summary.completedAt).toLocaleDateString()}`
            : ""}
        </p>
      </div>

      {summary.gate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {summary.gate.map((g, i) => (
              <p key={i}>
                <span className="text-muted-foreground">{g.prompt}: </span>
                <span className="font-medium">{g.answerLabel}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.coachingTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggested things to cover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.coachingTopics.map((t, i) => (
                <Badge key={i} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.flagged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where a tip would help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.flagged.map((f, i) => (
              <div key={i} className="text-sm border-l-2 border-amber-300 pl-3 space-y-0.5">
                <p className="font-medium">{f.prompt}</p>
                <p className="text-muted-foreground">
                  Chose: <span className="text-amber-800">{f.pickedLabel}</span> · Time-saver:{" "}
                  <span className="text-green-800">{f.coachedLabel}</span>
                </p>
                {f.coaching && (
                  <p className="text-muted-foreground flex gap-1">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    {f.coaching}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.selfAssessment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Self-assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {summary.selfAssessment.map((s, i) => (
              <p key={i}>
                <span className="text-muted-foreground">{s.prompt}: </span>
                <span className="font-medium">{s.ratingLabel}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.freeText.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In their words</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.freeText.map((t, i) => (
              <div key={i}>
                <p className="text-muted-foreground">{t.prompt}</p>
                <p className="italic">&ldquo;{t.value}&rdquo;</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
