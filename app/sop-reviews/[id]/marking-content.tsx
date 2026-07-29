"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, Check, X } from "lucide-react";

interface SopQuestion {
  id: number;
  order: number;
  questionText: string;
  markerNotes: string | null;
}

interface SopAnswer {
  id: number;
  questionId: number;
  answerText: string;
  verdict: string | null;
  trainerComment: string | null;
}

interface AssessmentView {
  id: number;
  status: string;
  submittedAt: string | null;
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
    documentPath: string | null;
    training: { id: number; title: string };
    sopQuestions: SopQuestion[];
  };
  answers: SopAnswer[];
  viewer: { isOwner: boolean; canMark: boolean };
  onCurrentRevision: boolean;
}

type Verdict = "Sufficient" | "Insufficient";

interface VerdictState {
  verdict: Verdict | null;
  comment: string;
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

export function MarkingContent({ assessmentId }: { assessmentId: number }) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  // Keyed by answerId.
  const [verdicts, setVerdicts] = useState<Record<number, VerdictState>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await api.get<AssessmentView>(
        `/api/sop-assessments/${assessmentId}`,
      );
      setAssessment(res.data);
      const initial: Record<number, VerdictState> = {};
      for (const answer of res.data.answers) {
        initial[answer.id] = {
          verdict: (answer.verdict as Verdict | null) ?? null,
          comment: answer.trainerComment ?? "",
        };
      }
      setVerdicts(initial);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 403 || e?.response?.status === 404) {
        setDenied(true);
      } else {
        toast.error(apiError(err, "Failed to load assessment"));
      }
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[60vh] w-full rounded-md" />
          <Skeleton className="h-[60vh] w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (denied || !assessment || !assessment.viewer.canMark) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              You are not a designated trainer for this SOP.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const answerByQuestion = new Map(
    assessment.answers.map((a) => [a.questionId, a]),
  );
  const markable = assessment.status === "Submitted";

  const setVerdict = (answerId: number, verdict: Verdict) => {
    setVerdicts((prev) => ({
      ...prev,
      [answerId]: { ...(prev[answerId] ?? { comment: "" }), verdict },
    }));
  };

  const setComment = (answerId: number, comment: string) => {
    setVerdicts((prev) => ({
      ...prev,
      [answerId]: { ...(prev[answerId] ?? { verdict: null }), comment },
    }));
  };

  const states = assessment.answers.map(
    (a) => verdicts[a.id] ?? { verdict: null, comment: "" },
  );
  const allMarked = states.every((s) => s.verdict !== null);
  const allSufficient = allMarked && states.every((s) => s.verdict === "Sufficient");
  const anyInsufficient = states.some((s) => s.verdict === "Insufficient");

  const buildVerdictsPayload = () =>
    assessment.answers
      .filter((a) => verdicts[a.id]?.verdict)
      .map((a) => ({
        answerId: a.id,
        verdict: verdicts[a.id].verdict as Verdict,
        trainerComment:
          verdicts[a.id].verdict === "Insufficient" && verdicts[a.id].comment.trim()
            ? verdicts[a.id].comment.trim()
            : undefined,
      }));

  const handleMark = async (action: "pass" | "requestChanges") => {
    setSubmitting(true);
    try {
      await api.post(`/api/sop-assessments/${assessmentId}/mark`, {
        action,
        verdicts: buildVerdictsPayload(),
      });
      toast.success(
        action === "pass" ? "Assessment passed" : "Changes requested",
      );
      router.push("/sop-reviews");
    } catch (err) {
      toast.error(apiError(err, "Failed to save marking"));
      setSubmitting(false);
    }
  };

  const employeeName = `${assessment.employee.preferredFirstName || assessment.employee.legalFirstName} ${assessment.employee.preferredLastName || assessment.employee.legalLastName}`;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sop-reviews")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Review queue
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">
            {assessment.revision.training.title.replace(/ - Task Sheet$/, "")}
          </h1>
          <Badge variant="outline">{assessment.revision.revisionLabel}</Badge>
          <Badge variant="secondary">{employeeName}</Badge>
        </div>
        {assessment.submittedAt && (
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(assessment.submittedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {!markable && (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          This assessment is not awaiting marking (status:{" "}
          {assessment.status}).
        </div>
      )}

      {!assessment.onCurrentRevision && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            This assessment was taken on a superseded revision. Passing it
            records completion against the old revision and may be immediately
            non-compliant if retraining-on-revision applies.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Procedure viewer */}
        <div>
          {assessment.revision.documentPath ? (
            <iframe
              src={`/api/images/${assessment.revision.documentPath}`}
              className="w-full h-[70vh] rounded border lg:sticky lg:top-4"
              title="SOP procedure"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">
                  No procedure PDF is attached to this revision.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Answers */}
        <div className="space-y-4">
          {assessment.revision.sopQuestions.map((question, index) => {
            const answer = answerByQuestion.get(question.id);
            if (!answer) return null;
            const state = verdicts[answer.id] ?? { verdict: null, comment: "" };
            return (
              <div key={question.id} className="rounded-md border p-4 space-y-3">
                <p className="text-sm font-medium">
                  {index + 1}. {question.questionText}
                </p>
                <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                  {answer.answerText || "—"}
                </p>
                {question.markerNotes && (
                  <p className="text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-3">
                    <span className="font-medium">What good looks like:</span>{" "}
                    {question.markerNotes}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={state.verdict === "Sufficient" ? "default" : "outline"}
                    className={cn(
                      state.verdict === "Sufficient" &&
                        "bg-green-600 hover:bg-green-700 text-white",
                    )}
                    onClick={() => setVerdict(answer.id, "Sufficient")}
                    disabled={!markable || submitting}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Sufficient
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      state.verdict === "Insufficient" ? "destructive" : "outline"
                    }
                    onClick={() => setVerdict(answer.id, "Insufficient")}
                    disabled={!markable || submitting}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Insufficient
                  </Button>
                </div>
                {state.verdict === "Insufficient" && (
                  <Textarea
                    value={state.comment}
                    onChange={(e) => setComment(answer.id, e.target.value)}
                    placeholder="What needs to change? Visible to the employee."
                    rows={2}
                    disabled={!markable || submitting}
                  />
                )}
              </div>
            );
          })}

          {markable && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="button"
                onClick={() => handleMark("pass")}
                disabled={!allSufficient || submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting ? "Saving…" : "Pass"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleMark("requestChanges")}
                disabled={!allMarked || !anyInsufficient || submitting}
              >
                Request changes
              </Button>
              {!allMarked && (
                <span className="text-sm text-muted-foreground">
                  Mark every answer to enable the actions.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
