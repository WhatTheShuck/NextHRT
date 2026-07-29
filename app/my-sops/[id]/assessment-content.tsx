"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AssessmentExportButton,
  AssessmentExportData,
} from "@/components/sop/assessment-export-button";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";

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
  markedAt: string | null;
  taskSheetRecordId: number | null;
  practicalRecordId: number | null;
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
  practicalRecord: { trainer: string } | null;
  viewer: { isOwner: boolean; canMark: boolean };
  onCurrentRevision: boolean;
}

const NON_TERMINAL = ["InProgress", "Submitted", "ChangesRequested"];

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

function statusBadge(status: string) {
  switch (status) {
    case "InProgress":
      return <Badge variant="secondary">In progress</Badge>;
    case "Submitted":
      return <Badge variant="secondary">Awaiting marking</Badge>;
    case "ChangesRequested":
      return <Badge className="bg-amber-500 text-white">Changes requested</Badge>;
    case "Passed":
      return <Badge className="bg-green-600 text-white">Passed</Badge>;
    case "Superseded":
      return <Badge variant="outline">Superseded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AssessmentContent({ assessmentId }: { assessmentId: number }) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  // Local editable copies keyed by questionId.
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await api.get<AssessmentView>(
        `/api/sop-assessments/${assessmentId}`,
      );
      setAssessment(res.data);
      const byQuestion: Record<number, string> = {};
      for (const answer of res.data.answers) {
        byQuestion[answer.questionId] = answer.answerText;
      }
      setDraft(byQuestion);
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
        <Skeleton className="h-[50vh] w-full rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
      </div>
    );
  }

  if (denied || !assessment) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              You don&apos;t have access to this assessment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const answerByQuestion = new Map(
    assessment.answers.map((a) => [a.questionId, a]),
  );

  const isEditable = (questionId: number): boolean => {
    if (assessment.status === "InProgress") return true;
    if (assessment.status === "ChangesRequested") {
      return answerByQuestion.get(questionId)?.verdict === "Insufficient";
    }
    return false;
  };

  const anyEditable =
    assessment.status === "InProgress" ||
    assessment.status === "ChangesRequested";
  const acknowledged = assessment.taskSheetRecordId !== null;

  const editableAnswersPayload = () =>
    assessment.revision.sopQuestions
      .filter((q) => isEditable(q.id))
      .map((q) => ({ questionId: q.id, answerText: draft[q.id] ?? "" }));

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await api.patch(`/api/sop-assessments/${assessmentId}`, {
        action: "acknowledge",
      });
      toast.success("Read acknowledgement recorded");
      await fetchAssessment();
    } catch (err) {
      toast.error(apiError(err, "Failed to record acknowledgement"));
    } finally {
      setAcknowledging(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/sop-assessments/${assessmentId}`, {
        action: "saveAnswers",
        answers: editableAnswersPayload(),
      });
      toast.success("Draft saved");
    } catch (err) {
      toast.error(apiError(err, "Failed to save draft"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save first so the submitted answers are exactly what's on screen.
      await api.patch(`/api/sop-assessments/${assessmentId}`, {
        action: "saveAnswers",
        answers: editableAnswersPayload(),
      });
      await api.patch(`/api/sop-assessments/${assessmentId}`, {
        action: "submit",
      });
      toast.success("Submitted for marking");
      await fetchAssessment();
    } catch (err) {
      const message = apiError(err, "Failed to submit");
      toast.error(
        message === "INCOMPLETE_ANSWERS"
          ? "Answer every question before submitting."
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await api.patch<{ id: number }>(
        `/api/sop-assessments/${assessmentId}`,
        { action: "restart" },
      );
      router.push(`/my-sops/${res.data.id}`);
      // The new page fetches the fresh assessment; force a reload of this route.
      router.refresh();
    } catch (err) {
      toast.error(apiError(err, "Failed to restart assessment"));
      setRestarting(false);
    }
  };

  const exportData: AssessmentExportData = {
    sopTitle: assessment.revision.training.title.replace(/ - Task Sheet$/, ""),
    revisionLabel: assessment.revision.revisionLabel,
    employeeName: `${assessment.employee.preferredFirstName || assessment.employee.legalFirstName} ${assessment.employee.preferredLastName || assessment.employee.legalLastName}`,
    trainerName: assessment.practicalRecord?.trainer ?? null,
    submittedAt: assessment.submittedAt
      ? new Date(assessment.submittedAt).toLocaleDateString()
      : null,
    markedAt: assessment.markedAt
      ? new Date(assessment.markedAt).toLocaleDateString()
      : null,
    status: assessment.status,
    rows: assessment.revision.sopQuestions.map((q) => {
      const answer = answerByQuestion.get(q.id);
      return {
        order: q.order,
        questionText: q.questionText,
        answerText: answer?.answerText ?? "",
        verdict: answer?.verdict ?? null,
        trainerComment: answer?.trainerComment ?? null,
      };
    }),
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/my-sops")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          My SOPs
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold">
            {exportData.sopTitle}
          </h1>
          <Badge variant="outline">{assessment.revision.revisionLabel}</Badge>
          {statusBadge(assessment.status)}
        </div>
      </div>

      {!assessment.onCurrentRevision &&
        NON_TERMINAL.includes(assessment.status) && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-48">
              A newer revision of this SOP is now current. You can restart on
              the current revision — restarting discards your existing answers.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestart}
              disabled={restarting}
            >
              {restarting ? "Restarting…" : "Restart on current revision"}
            </Button>
          </div>
        )}

      {/* Procedure viewer */}
      {assessment.revision.documentPath ? (
        <iframe
          src={`/api/images/${assessment.revision.documentPath}`}
          className="w-full h-[70vh] rounded border"
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

      {/* Read acknowledgement */}
      <div className="flex items-center gap-3 rounded-md border p-4">
        <Checkbox
          id="read-ack"
          checked={acknowledged}
          disabled={acknowledged || acknowledging || !anyEditable}
          onCheckedChange={(checked) => {
            if (checked === true && !acknowledged) handleAcknowledge();
          }}
        />
        <Label htmlFor="read-ack" className="text-sm font-normal">
          I have read and understood this SOP
        </Label>
        {acknowledged && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            recorded
          </span>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Assessment questions</h2>
        {assessment.revision.sopQuestions.map((question, index) => {
          const answer = answerByQuestion.get(question.id);
          const editable = isEditable(question.id);
          return (
            <div key={question.id} className="rounded-md border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {index + 1}. {question.questionText}
                </p>
                {answer?.verdict === "Sufficient" && (
                  <Badge className="bg-green-600 text-white shrink-0">
                    Sufficient
                  </Badge>
                )}
                {answer?.verdict === "Insufficient" && (
                  <Badge variant="destructive" className="shrink-0">
                    Insufficient
                  </Badge>
                )}
              </div>
              {editable ? (
                <Textarea
                  value={draft[question.id] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [question.id]: e.target.value,
                    }))
                  }
                  placeholder="Your answer…"
                  rows={3}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground rounded-md bg-muted/50 p-3">
                  {answer?.answerText || "—"}
                </p>
              )}
              {answer?.trainerComment && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <span className="font-medium">Trainer:</span>{" "}
                  {answer.trainerComment}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {anyEditable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || submitting}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!acknowledged || saving || submitting}
                  >
                    {submitting ? "Submitting…" : "Submit for marking"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!acknowledged && (
                <TooltipContent>
                  Tick the read acknowledgement first.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {assessment.status === "Passed" && (
        <div className="flex items-center gap-2">
          <AssessmentExportButton data={exportData} />
        </div>
      )}
    </div>
  );
}
