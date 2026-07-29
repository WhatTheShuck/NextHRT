"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { Employee } from "@/generated/prisma_client/client";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Upload,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";

// Renders inside the edit-training dialog for SOP trainings only.
// Everything is keyed on the *pair*: content lives on the Task Sheet side.

interface SopPair {
  taskSheetId: number;
  practicalId: number;
}

interface RevisionOption {
  id: number;
  revisionLabel: string;
  effectiveDate: string;
  documentPath: string | null;
}

interface QuestionRow {
  id?: number;
  order: number;
  questionText: string;
  markerNotes: string;
}

interface Trainer {
  trainingId: number;
  employeeId: number;
  employee: {
    id: number;
    legalFirstName: string;
    legalLastName: string;
    preferredFirstName: string | null;
    preferredLastName: string | null;
    User: { email: string } | null;
  };
}

// Split pasted text into individual question rows, stripping leading list
// markers like "1.", "2)" etc.
function splitPastedQuestions(pasted: string): string[] {
  return pasted
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

export function SopPairSection({ trainingId }: { trainingId: number }) {
  const [pair, setPair] = useState<SopPair | null | "loading">("loading");
  const [revisions, setRevisions] = useState<RevisionOption[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingTrainers, setSavingTrainers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRevision = revisions.find(
    (r) => r.id.toString() === selectedRevisionId,
  );

  // 1. Resolve the pair for this training.
  useEffect(() => {
    let cancelled = false;
    setPair("loading");
    api
      .get<SopPair | null>(`/api/training/${trainingId}/sop-pair`)
      .then((res) => {
        if (!cancelled) setPair(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setPair(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  const taskSheetId = pair && pair !== "loading" ? pair.taskSheetId : null;

  // 2. Load revisions (newest first) once the pair is known.
  const fetchRevisions = useCallback(async () => {
    if (!taskSheetId) return;
    try {
      const res = await api.get<RevisionOption[]>(
        `/api/training/${taskSheetId}/revisions`,
      );
      setRevisions(res.data);
      setSelectedRevisionId((prev) => {
        if (prev && res.data.some((r) => r.id.toString() === prev)) return prev;
        return res.data[0]?.id.toString() ?? "";
      });
    } catch (err) {
      toast.error(apiError(err, "Failed to load revisions"));
    }
  }, [taskSheetId]);

  useEffect(() => {
    if (!taskSheetId) return;
    fetchRevisions();
  }, [taskSheetId, fetchRevisions]);

  // 4. Load trainers + the employee list for the picker.
  const fetchTrainers = useCallback(async () => {
    if (!taskSheetId) return;
    try {
      const res = await api.get<Trainer[]>(
        `/api/training/${taskSheetId}/sop-trainers`,
      );
      setTrainers(res.data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load trainers"));
    }
  }, [taskSheetId]);

  useEffect(() => {
    if (!taskSheetId) return;
    fetchTrainers();
    api
      .get<Employee[]>("/api/employees?activeOnly=true")
      .then((res) => setEmployees(res.data))
      .catch(() => {
        /* non-fatal: picker stays empty */
      });
  }, [taskSheetId, fetchTrainers]);

  // 3. Load questions for the selected revision.
  useEffect(() => {
    if (!taskSheetId || !selectedRevisionId) return;
    let cancelled = false;
    api
      .get<{ questions: QuestionRow[]; hasSubmissions: boolean }>(
        `/api/training/${taskSheetId}/sop-questions?revisionId=${selectedRevisionId}`,
      )
      .then((res) => {
        if (cancelled) return;
        setQuestions(
          res.data.questions.map((q) => ({
            id: q.id,
            order: q.order,
            questionText: q.questionText,
            markerNotes: q.markerNotes ?? "",
          })),
        );
        setHasSubmissions(res.data.hasSubmissions);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiError(err, "Failed to load questions"));
      });
    return () => {
      cancelled = true;
    };
  }, [taskSheetId, selectedRevisionId]);

  // ── Block a: procedure PDF ──────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!taskSheetId || !selectedRevisionId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(
        `/api/training/${taskSheetId}/sop-document?revisionId=${selectedRevisionId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("Procedure PDF uploaded");
      await fetchRevisions();
    } catch (err) {
      toast.error(apiError(err, "Failed to upload document"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveDocument = async () => {
    if (!taskSheetId || !selectedRevisionId) return;
    setUploading(true);
    try {
      await api.delete(
        `/api/training/${taskSheetId}/sop-document?revisionId=${selectedRevisionId}`,
      );
      toast.success("Procedure PDF removed");
      await fetchRevisions();
    } catch (err) {
      toast.error(apiError(err, "Failed to remove document"));
    } finally {
      setUploading(false);
    }
  };

  // ── Block b: questions editor ───────────────────────────────────────────
  const updateQuestion = (index: number, patch: Partial<QuestionRow>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const deleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { order: prev.length + 1, questionText: "", markerNotes: "" },
    ]);
  };

  const handleSplitPaste = () => {
    const lines = splitPastedQuestions(pasteText);
    if (lines.length === 0) return;
    setQuestions((prev) => [
      ...prev,
      ...lines.map((questionText, i) => ({
        order: prev.length + i + 1,
        questionText,
        markerNotes: "",
      })),
    ]);
    setPasteText("");
    setShowPaste(false);
  };

  const handleSaveQuestions = async () => {
    if (!taskSheetId || !selectedRevisionId) return;
    setSavingQuestions(true);
    try {
      const res = await api.put<{ questions: QuestionRow[] }>(
        `/api/training/${taskSheetId}/sop-questions?revisionId=${selectedRevisionId}`,
        {
          questions: questions.map((row, i) => ({
            id: row.id,
            order: i + 1,
            questionText: row.questionText,
            markerNotes: row.markerNotes.trim() ? row.markerNotes : null,
          })),
        },
      );
      setQuestions(
        res.data.questions.map((q) => ({
          id: q.id,
          order: q.order,
          questionText: q.questionText,
          markerNotes: q.markerNotes ?? "",
        })),
      );
      toast.success("Questions saved");
    } catch (err) {
      // QUESTION_IN_USE arrives here pre-formatted ("In use by N assessment(s)…").
      toast.error(apiError(err, "Failed to save questions"));
    } finally {
      setSavingQuestions(false);
    }
  };

  // ── Block c: designated trainers ────────────────────────────────────────
  const saveTrainers = async (employeeIds: number[]) => {
    if (!taskSheetId) return;
    setSavingTrainers(true);
    try {
      const res = await api.put<Trainer[]>(
        `/api/training/${taskSheetId}/sop-trainers`,
        { employeeIds },
      );
      setTrainers(res.data);
    } catch (err) {
      toast.error(apiError(err, "Failed to update trainers"));
      // Re-sync from server on failure.
      fetchTrainers();
    } finally {
      setSavingTrainers(false);
    }
  };

  const addTrainer = (employeeId: string) => {
    const id = parseInt(employeeId);
    if (isNaN(id) || trainers.some((t) => t.employeeId === id)) return;
    saveTrainers([...trainers.map((t) => t.employeeId), id]);
  };

  const removeTrainer = (employeeId: number) => {
    saveTrainers(trainers.filter((t) => t.employeeId !== employeeId).map((t) => t.employeeId));
  };

  const availableEmployees = employees.filter(
    (e) => !trainers.some((t) => t.employeeId === e.id),
  );

  // ── Render ──────────────────────────────────────────────────────────────
  if (pair === "loading") {
    return (
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground">Loading SOP setup…</p>
      </div>
    );
  }

  if (pair === null) {
    return (
      <div className="border-t pt-4">
        <Label className="text-sm font-medium">SOP Setup</Label>
        <p className="mt-2 text-sm text-muted-foreground">
          This SOP pair is not linked. Run{" "}
          <code className="text-xs">scripts/backfill-sop-partners.ts</code> or
          recreate the pair.
        </p>
      </div>
    );
  }

  const hasDocument = !!selectedRevision?.documentPath;

  return (
    <div className="border-t pt-4 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">SOP Setup</Label>
        <div className="w-56 max-w-[50%]">
          <Select
            value={selectedRevisionId}
            onValueChange={setSelectedRevisionId}
            disabled={revisions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select revision" />
            </SelectTrigger>
            <SelectContent>
              {revisions.map((rev) => (
                <SelectItem key={rev.id} value={rev.id.toString()}>
                  {rev.revisionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a revision above to manage the procedure PDF and questions.
        </p>
      ) : (
        <>
          {/* a) Procedure PDF */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Procedure PDF</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {hasDocument ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Procedure PDF uploaded
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No procedure PDF for this revision.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? "Working…" : hasDocument ? "Replace PDF" : "Upload PDF"}
              </Button>
              {hasDocument && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemoveDocument}
                  disabled={uploading}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Export the PDF from Word via <strong>File → Export → Create
              PDF/XPS</strong>. Upload the <strong>procedure only — without the
              questions section</strong>; questions are managed below and HRT
              appends them to downloads automatically.
            </p>
          </div>

          {/* b) Questions editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Questions</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaste((v) => !v)}
                >
                  Paste questions
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add question
                </Button>
              </div>
            </div>

            {hasSubmissions && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Employees have already submitted answers against this revision
                  — edits change what future markers see.
                </span>
              </div>
            )}

            {showPaste && (
              <div className="space-y-2 rounded-md border p-3">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Paste a numbered or line-separated list of questions…"}
                  rows={4}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSplitPaste}
                    disabled={!pasteText.trim()}
                  >
                    Split into rows
                  </Button>
                </div>
              </div>
            )}

            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions yet. Add one or paste a list.
              </p>
            ) : (
              <ul className="space-y-3">
                {questions.map((q, index) => (
                  <li key={q.id ?? `new-${index}`} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-sm text-muted-foreground pt-2 w-6 shrink-0">
                        {index + 1}.
                      </span>
                      <div className="flex-1 space-y-2 min-w-0">
                        <Textarea
                          value={q.questionText}
                          onChange={(e) =>
                            updateQuestion(index, { questionText: e.target.value })
                          }
                          placeholder="Question text"
                          rows={2}
                        />
                        <Textarea
                          value={q.markerNotes}
                          onChange={(e) =>
                            updateQuestion(index, { markerNotes: e.target.value })
                          }
                          placeholder="What does a good answer look like? Visible to trainers only"
                          rows={2}
                        />
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveQuestion(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span className="sr-only">Move up</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === questions.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span className="sr-only">Move down</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteQuestion(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete question</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSaveQuestions}
                disabled={savingQuestions}
              >
                {savingQuestions ? "Saving…" : "Save questions"}
              </Button>
            </div>
          </div>

          {/* c) Designated trainers */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Designated trainers</Label>
            {trainers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No designated trainers yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {trainers.map((t) => (
                  <li
                    key={t.employeeId}
                    className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">
                        {t.employee.legalFirstName} {t.employee.legalLastName}
                      </span>
                      {t.employee.User === null && (
                        <Badge variant="secondary" className="text-xs">
                          no account — won&apos;t receive notifications or see the
                          review queue
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeTrainer(t.employeeId)}
                      disabled={savingTrainers}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Remove trainer</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <EmployeeCombobox
              employees={availableEmployees}
              selectedEmployeeId={null}
              onSelect={addTrainer}
              disabled={savingTrainers}
              placeholder="Add a designated trainer…"
            />
          </div>

          {/* d) Download */}
          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `/api/training/${taskSheetId}/sop-pdf?revisionId=${selectedRevisionId}`,
                        )
                      }
                      disabled={!hasDocument}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download SOP PDF (procedure + questions)
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasDocument && (
                  <TooltipContent>
                    Upload a procedure PDF for this revision first.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      )}
    </div>
  );
}
