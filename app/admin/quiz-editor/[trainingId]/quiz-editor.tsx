"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import {
  QuizDocumentSchema,
  QuizDocumentShapeSchema,
  type QuizDocument,
} from "@/lib/quiz/schema";
import { describeIssues, isRenderable, starterDocument } from "@/lib/quiz/editor";
import { QuizVisualEditor } from "./quiz-visual-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

export interface EditorContext {
  id: number;
  title: string;
  category: string;
  currentRevisionId: number | null;
  revisions: { id: number; revisionLabel: string }[];
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  const data = e?.response?.data;
  if (data?.error && data.detail) return `${data.error}: ${data.detail}`;
  return data?.error ?? e?.message ?? fallback;
}

/** Stable serialisation used both for saving and for dirty-checking. */
function serialise(doc: QuizDocument | null): string {
  return doc ? JSON.stringify(doc) : "";
}

export function QuizEditor({
  context,
  initialRevisionId,
}: {
  context: EditorContext;
  initialRevisionId: number | null;
}) {
  const [revisionId, setRevisionId] = useState<number | null>(
    initialRevisionId ?? context.currentRevisionId ?? context.revisions[0]?.id ?? null,
  );
  const [pendingRevisionId, setPendingRevisionId] = useState<number | null>(null);

  const [saved, setSaved] = useState(""); // serialised document as last loaded/saved
  const [draft, setDraft] = useState<QuizDocument | null>(null);
  const [hasResponses, setHasResponses] = useState(false);
  const [loading, setLoading] = useState(revisionId != null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const [tab, setTab] = useState<"visual" | "json">("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Load whenever the revision changes. The busy/cleared state is set by
  // switchRevision (an event), so the effect only applies the fetch result.
  useEffect(() => {
    if (revisionId == null) return;
    let cancelled = false;
    api
      .get<{ content: string | null; hasResponses: boolean }>(
        `/api/training/${context.id}/quiz-content?revisionId=${revisionId}`,
      )
      .then((res) => {
        if (cancelled) return;
        const doc = res.data.content ? (JSON.parse(res.data.content) as QuizDocument) : null;
        setDraft(doc);
        setSaved(serialise(doc));
        setJsonText(doc ? JSON.stringify(doc, null, 2) : "");
        setHasResponses(res.data.hasResponses);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err, "Failed to load the questionnaire"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [context.id, revisionId]);

  const switchRevision = (id: number | null) => {
    setLoading(id != null);
    setError("");
    setSuccess("");
    setJsonError("");
    setRevisionId(id);
  };

  const dirty = serialise(draft) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const issues = useMemo(() => {
    if (!draft) return [];
    const result = QuizDocumentSchema.safeParse(draft);
    return result.success ? [] : describeIssues(draft, result.error.issues);
  }, [draft]);

  const counts = useMemo(() => {
    if (!draft) return null;
    const items = draft.sections.flatMap((s) => s.items);
    return {
      sections: draft.sections.length,
      questions: items.filter((i) => i.type !== "info").length,
    };
  }, [draft]);

  const onJsonChange = (text: string) => {
    setJsonText(text);
    setSuccess("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setJsonError(`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    const shape = QuizDocumentShapeSchema.safeParse(parsed);
    if (!shape.success && !isRenderable(shape.error.issues)) {
      setJsonError(
        `Not a questionnaire document: ${shape.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`)
          .join("; ")}`,
      );
      return;
    }
    setJsonError("");
    setDraft(parsed as QuizDocument);
  };

  const onTabChange = (next: string) => {
    if (next === "json") {
      setJsonText(draft ? JSON.stringify(draft, null, 2) : "");
      setJsonError("");
    }
    setTab(next as "visual" | "json");
  };

  const editDraft = (doc: QuizDocument) => {
    setDraft(doc);
    setSuccess("");
  };

  const save = async (confirm: boolean) => {
    if (revisionId == null || !draft) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const content = serialise(draft);
      await api.put(`/api/training/${context.id}/quiz-content?revisionId=${revisionId}`, {
        content,
        confirm,
      });
      setSaved(content);
      setSuccess("Questionnaire saved.");
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === "QUIZ_HAS_RESPONSES") {
        setShowConfirm(true);
      } else {
        setError(apiError(err, "Failed to save the questionnaire"));
      }
    } finally {
      setSaving(false);
    }
  };

  // Saving blank content clears the questionnaire; the server refuses this
  // once anyone has answered the revision.
  const remove = async () => {
    if (revisionId == null) return;
    setShowRemove(false);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/api/training/${context.id}/quiz-content?revisionId=${revisionId}`, {
        content: "",
      });
      setDraft(null);
      setSaved("");
      setJsonText("");
      setJsonError("");
      setTab("visual");
      setSuccess("Questionnaire removed.");
    } catch (err) {
      setError(apiError(err, "Failed to remove the questionnaire"));
    } finally {
      setSaving(false);
    }
  };

  const changeRevision = (id: number) => {
    if (dirty) setPendingRevisionId(id);
    else switchRevision(id);
  };

  const discard = () => {
    const doc = saved ? (JSON.parse(saved) as QuizDocument) : null;
    setDraft(doc);
    setJsonText(doc ? JSON.stringify(doc, null, 2) : "");
    setJsonError("");
    setSuccess("");
  };

  const busy = loading || saving;
  const isCurrent = revisionId === context.currentRevisionId;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/admin/quiz-results">
            <ArrowLeft className="h-4 w-4 mr-1" /> Questionnaires
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl md:text-2xl font-semibold">{context.title}</h1>
          <Badge variant="outline">Questionnaire editor</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Questionnaires are versioned per revision. Edit the current revision to
          change what employees see next time they open it.
        </p>
      </div>

      {context.revisions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            This training has no revisions yet. Add one from the training&apos;s
            edit dialog first — questionnaire content is stored per revision.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1" data-tour="quiz-revision">
              <Label htmlFor="quiz-revision" className="text-xs">
                Revision
              </Label>
              <Select
                value={revisionId?.toString() ?? ""}
                onValueChange={(v) => changeRevision(Number(v))}
                disabled={busy}
              >
                <SelectTrigger id="quiz-revision" className="w-64 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {context.revisions.map((rev) => (
                    <SelectItem key={rev.id} value={rev.id.toString()}>
                      {rev.revisionLabel}
                      {rev.id === context.currentRevisionId ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {counts && (
              <p className="text-sm text-muted-foreground pb-2">
                {counts.sections} section{counts.sections === 1 ? "" : "s"} ·{" "}
                {counts.questions} question{counts.questions === 1 ? "" : "s"}
              </p>
            )}
            {!isCurrent && revisionId != null && (
              <Badge variant="secondary" className="mb-2">
                Not the current revision
              </Badge>
            )}
            {saved && !hasResponses && !loading && (
              <Button
                data-tour="quiz-remove"
                type="button"
                variant="ghost"
                size="sm"
                className="mb-1 ml-auto text-destructive"
                onClick={() => setShowRemove(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remove questionnaire
              </Button>
            )}
          </div>

          {hasResponses && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 border border-amber-200 flex gap-2" data-tour="quiz-has-responses">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                People have already started or completed this revision. Wording
                fixes are fine; for material changes, add a new revision instead
                (it copies this questionnaire forward). The questionnaire can&apos;t
                be removed from this revision.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !draft ? (
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                {success && (
                  <p className="text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {success}
                  </p>
                )}
                <p className="text-muted-foreground">
                  This revision has no questionnaire, so the training isn&apos;t
                  interactive on it.
                </p>
                <Button type="button" onClick={() => editDraft(starterDocument())} data-tour="quiz-start">
                  Start a questionnaire
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={tab} onValueChange={onTabChange}>
              <TabsList data-tour="quiz-tabs">
                <TabsTrigger value="visual" disabled={Boolean(jsonError)}>
                  Visual
                </TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="visual" className="mt-4">
                <QuizVisualEditor doc={draft} onChange={editDraft} disabled={saving} />
              </TabsContent>
              <TabsContent value="json" className="mt-4 space-y-2">
                <Textarea
                  value={jsonText}
                  onChange={(e) => onJsonChange(e.target.value)}
                  className="font-mono text-xs min-h-[60vh]"
                  spellCheck={false}
                  disabled={saving}
                />
                {jsonError && (
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{jsonError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  For bulk edits and ids. Valid changes show up in the Visual tab
                  straight away.
                </p>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Sticky save bar */}
      {draft && (
        <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom,0px)]">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {issues.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-red-700">
                    {issues.length} thing{issues.length === 1 ? "" : "s"} to fix before saving
                  </summary>
                  <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-red-800">
                    {issues.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </details>
              ) : jsonError ? (
                <span className="text-red-700">Fix the JSON to continue.</span>
              ) : success && !dirty ? (
                <span className="text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> {success}
                </span>
              ) : dirty ? (
                <span className="text-muted-foreground">Unsaved changes</span>
              ) : (
                <span className="text-muted-foreground">No changes</span>
              )}
            </div>
            <Button type="button" variant="outline" onClick={discard} disabled={busy || !dirty}>
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => save(false)}
              disabled={busy || !dirty || issues.length > 0 || Boolean(jsonError)}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={showRemove} onOpenChange={setShowRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this questionnaire?</AlertDialogTitle>
            <AlertDialogDescription>
              The questionnaire is deleted from this revision
              {isCurrent ? ", and the training stops being interactive for everyone it's assigned to" : ""}.
              {dirty ? " Your unsaved changes will be lost too." : ""} You can
              start a new one afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove questionnaire</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save over a revision with responses?</AlertDialogTitle>
            <AlertDialogDescription>
              People have already answered this revision. Their answers are kept
              (they&apos;re matched by question id), but anyone mid-way will see the
              new content. Material changes belong in a new revision. Save anyway?
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
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRevisionId !== null}
        onOpenChange={(open) => !open && setPendingRevisionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching revision will throw away the changes you haven&apos;t saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                switchRevision(pendingRevisionId);
                setPendingRevisionId(null);
              }}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
