"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RevisionRow {
  id: number;
  revisionLabel: string;
}

interface QuizContentSectionProps {
  trainingId: number;
  revisions: RevisionRow[];
  currentRevisionId: number | null;
}

/**
 * Per-revision JSON editor for interactive-quiz content. A training "is
 * interactive" when its current revision carries quizContent. Content is
 * zod-validated server-side; validation errors surface inline, and editing a
 * revision that already has responses prompts a confirm (material changes
 * belong in a new revision).
 */
export function QuizContentSection({
  trainingId,
  revisions,
  currentRevisionId,
}: QuizContentSectionProps) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(
    currentRevisionId ?? revisions[0]?.id ?? null,
  );
  const [content, setContent] = useState("");
  const [hasResponses, setHasResponses] = useState(false);
  const [currentHasContent, setCurrentHasContent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const loadContent = useCallback(
    async (revisionId: number) => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res = await api.get<{ content: string | null; hasResponses: boolean }>(
          `/api/training/${trainingId}/quiz-content?revisionId=${revisionId}`,
        );
        setContent(res.data.content ?? "");
        setHasResponses(res.data.hasResponses);
      } catch (err: any) {
        setError(err.response?.data?.error ?? err.message ?? "Failed to load content");
      } finally {
        setLoading(false);
      }
    },
    [trainingId],
  );

  // Track whether the current revision has content (for the "Interactive" badge).
  useEffect(() => {
    if (currentRevisionId == null) {
      setCurrentHasContent(false);
      return;
    }
    api
      .get<{ content: string | null }>(
        `/api/training/${trainingId}/quiz-content?revisionId=${currentRevisionId}`,
      )
      .then((res) => setCurrentHasContent(Boolean(res.data.content)))
      .catch(() => setCurrentHasContent(false));
  }, [trainingId, currentRevisionId]);

  useEffect(() => {
    if (selectedRevisionId != null) loadContent(selectedRevisionId);
  }, [selectedRevisionId, loadContent]);

  const save = async (confirm: boolean) => {
    if (selectedRevisionId == null) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(
        `/api/training/${trainingId}/quiz-content?revisionId=${selectedRevisionId}`,
        { content, confirm },
      );
      setSuccess("Quiz content saved.");
      if (selectedRevisionId === currentRevisionId) setCurrentHasContent(Boolean(content));
      setHasResponses(hasResponses); // unchanged
    } catch (err: any) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.code === "QUIZ_HAS_RESPONSES") {
        setShowConfirm(true);
      } else if (err.response?.status === 400 && data?.detail) {
        setError(`${data.error}: ${data.detail}`);
      } else {
        setError(data?.error ?? err.message ?? "Failed to save content");
      }
    } finally {
      setSaving(false);
    }
  };

  if (revisions.length === 0) {
    return (
      <div className="border-t pt-4">
        <Label className="text-sm font-medium">Interactive Questionnaire</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Add a revision first — quiz content is versioned per revision.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">Interactive Questionnaire (JSON)</Label>
        {currentHasContent && (
          <Badge variant="default" className="text-xs">
            Interactive
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Content is a validated JSON document, versioned per revision. Leave blank
        for a non-interactive training. Edit the current revision to change what
        new starters see.
      </p>

      <div className="space-y-2">
        <Label htmlFor="quiz-revision" className="text-xs">
          Revision
        </Label>
        <Select
          value={selectedRevisionId?.toString() ?? ""}
          onValueChange={(v) => setSelectedRevisionId(Number(v))}
          disabled={saving || loading}
        >
          <SelectTrigger id="quiz-revision">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {revisions.map((rev) => (
              <SelectItem key={rev.id} value={rev.id.toString()}>
                {rev.revisionLabel}
                {rev.id === currentRevisionId ? " (current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasResponses && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
          This revision already has questionnaire responses. Material changes
          belong in a new revision.
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder='{ "version": 1, "sections": [ ... ] }'
        className="font-mono text-xs min-h-[240px]"
        disabled={saving || loading}
        spellCheck={false}
      />

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-800 border border-red-200 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-2 text-xs text-green-800 border border-green-200">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => save(false)}
          disabled={saving || loading}
        >
          {saving ? "Saving..." : "Save Quiz Content"}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit content with existing responses?</AlertDialogTitle>
            <AlertDialogDescription>
              This revision already has questionnaire responses. Answers are keyed
              by question id so nothing breaks, but material changes belong in a
              new revision. Save anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                save(true);
              }}
              disabled={saving}
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
