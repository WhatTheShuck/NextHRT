"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { visibleItems, type QuizDocument, type QuizItem } from "@/lib/quiz/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Lightbulb, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoredAnswer {
  value: unknown;
  wasCorrect?: boolean;
}
interface Reveal {
  correctOptionId: string;
  coaching: string | null;
  wasCorrect: boolean;
}
interface ResponseData {
  id: number;
  status: string;
  trainingTitle: string;
  onCurrentRevision: boolean;
  document: QuizDocument;
  answers: Record<string, StoredAnswer>;
  reveals: Record<string, Reveal>;
  viewer: { isOwner: boolean; isAdmin: boolean };
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

function isRequired(item: QuizItem): boolean {
  if (item.type === "info") return false;
  if (item.type === "text" && item.optional) return false;
  return true;
}

function isAnswered(item: QuizItem, stored: StoredAnswer | undefined): boolean {
  if (!stored) return false;
  const v = stored.value;
  switch (item.type) {
    case "multiselect":
      return Array.isArray(v);
    case "text":
      return typeof v === "string" && (item.optional || v.trim().length > 0);
    case "scale":
      return typeof v === "number";
    case "choice":
      return typeof v === "string" && v.length > 0;
    case "info":
      return true;
  }
}

/** Render an info card body preserving line breaks (full markdown deferred). */
function InfoBody({ body }: { body: string }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      {body.split("\n").map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export function QuizPlayer({ responseId }: { responseId: number }) {
  const router = useRouter();
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [answers, setAnswers] = useState<Record<string, StoredAnswer>>({});
  const [reveals, setReveals] = useState<Record<string, Reveal>>({});
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [itemError, setItemError] = useState("");
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get<ResponseData>(`/api/quiz-responses/${responseId}`);
      setData(res.data);
      setAnswers(res.data.answers ?? {});
      setReveals(res.data.reveals ?? {});
    } catch (err) {
      setLoadError(apiError(err, "Failed to load questionnaire"));
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  useEffect(() => {
    load();
  }, [load]);

  const doc = data?.document ?? null;
  const readOnly = !data || data.status !== "InProgress";

  const visible = useMemo(
    () => (doc ? visibleItems(doc, answers) : []),
    [doc, answers],
  );

  // Clamp the index if the visible set shrank (e.g. gate change).
  useEffect(() => {
    if (visible.length && index > visible.length - 1) setIndex(visible.length - 1);
  }, [visible.length, index]);

  const current = visible[index]?.item ?? null;
  const currentSection = visible[index]?.sectionId ?? null;
  const locked = current ? reveals[current.id] !== undefined : false;

  // Initialise the draft when the current item changes.
  useEffect(() => {
    if (!current) return;
    const stored = answers[current.id];
    if (stored !== undefined) setDraft(stored.value);
    else if (current.type === "multiselect") setDraft([]);
    else setDraft(null);
    setItemError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const requiredVisible = visible.filter((v) => isRequired(v.item));
  const answeredRequired = requiredVisible.filter((v) =>
    isAnswered(v.item, answers[v.item.id]),
  ).length;
  const allComplete =
    requiredVisible.length > 0 && answeredRequired === requiredVisible.length;
  const progress = requiredVisible.length
    ? Math.round((answeredRequired / requiredVisible.length) * 100)
    : 0;

  const persist = async (itemId: string, value: unknown) => {
    const res = await api.patch<{
      locked: boolean;
      wasCorrect?: boolean;
      correctOptionId?: string;
      coaching?: string | null;
    }>(`/api/quiz-responses/${responseId}`, { action: "saveAnswer", itemId, value });
    const reveal = res.data;
    setAnswers((prev) => ({
      ...prev,
      [itemId]: { value, ...(reveal.wasCorrect !== undefined ? { wasCorrect: reveal.wasCorrect } : {}) },
    }));
    if (reveal.locked && reveal.correctOptionId) {
      setReveals((prev) => ({
        ...prev,
        [itemId]: {
          correctOptionId: reveal.correctOptionId!,
          coaching: reveal.coaching ?? null,
          wasCorrect: reveal.wasCorrect ?? false,
        },
      }));
    }
    return reveal;
  };

  const goNext = () => {
    if (index < visible.length - 1) setIndex(index + 1);
  };
  const goBack = () => {
    if (index > 0) setIndex(index - 1);
  };

  // Advance handler for the current item.
  const handleForward = async () => {
    if (!current) return;
    setBusy(true);
    setItemError("");
    try {
      if (current.type === "info") {
        await persist(current.id, true);
        goNext();
      } else if (current.type === "choice") {
        if (locked) {
          goNext();
        } else {
          if (typeof draft !== "string" || !draft) {
            setItemError("Pick an option to continue.");
            return;
          }
          const reveal = await persist(current.id, draft);
          if (!reveal.locked) goNext(); // gate / survey choice — no reveal
          // knowledge choice: stay put; reveal now shows, button becomes Next
        }
      } else if (current.type === "scale") {
        if (typeof draft !== "number") {
          setItemError("Pick a rating to continue.");
          return;
        }
        await persist(current.id, draft);
        goNext();
      } else if (current.type === "multiselect") {
        await persist(current.id, Array.isArray(draft) ? draft : []);
        goNext();
      } else if (current.type === "text") {
        const value = typeof draft === "string" ? draft : "";
        if (!current.optional && !value.trim()) {
          setItemError("This answer is required.");
          return;
        }
        await persist(current.id, value);
        goNext();
      }
    } catch (err) {
      setItemError(apiError(err, "Failed to save your answer"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    setBusy(true);
    setItemError("");
    try {
      await api.patch(`/api/quiz-responses/${responseId}`, { action: "submit" });
      await load(); // reloads as Completed → review/confirmation
    } catch (err) {
      setItemError(apiError(err, "Failed to submit"));
    } finally {
      setBusy(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await api.patch<{ id: number }>(`/api/quiz-responses/${responseId}`, {
        action: "restart",
      });
      router.replace(`/quiz/${res.data.id}`);
    } catch (err) {
      setItemError(apiError(err, "Failed to restart"));
      setRestarting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (loadError || !data || !doc) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {loadError || "Questionnaire unavailable."}
        </div>
      </div>
    );
  }

  // ── Completed / review confirmation ──────────────────────────────────────
  if (data.status === "Completed") {
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <h1 className="text-xl font-semibold">{data.trainingTitle}</h1>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <p className="font-medium">Thanks — that's everything we need.</p>
            <p className="text-muted-foreground">
              IT will use your answers to shape your introduction. Nothing here is
              marked or graded. You can reopen this page any time for the tips you
              picked up along the way.
            </p>
            <p className="text-muted-foreground">
              Tip: find everything from <strong>KSB Central</strong> — the managed
              bookmark at the top-left of your browser's bookmarks bar.
            </p>
          </CardContent>
        </Card>
        {/* Review of coaching for locked items */}
        {visible.some((v) => reveals[v.item.id]) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your tips to keep</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visible
                .filter((v) => reveals[v.item.id]?.coaching)
                .map((v) => (
                  <div key={v.item.id} className="text-sm">
                    <p className="font-medium">{v.item.prompt}</p>
                    <p className="text-muted-foreground flex gap-2">
                      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                      {reveals[v.item.id].coaching}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Stale-revision restart prompt ────────────────────────────────────────
  if (!data.onCurrentRevision) {
    return (
      <div className="mx-auto max-w-2xl p-4 space-y-4">
        <h1 className="text-xl font-semibold">{data.trainingTitle}</h1>
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <p>
              A newer version of this questionnaire is now available. Restart to
              take the current version — your previous progress will be set aside.
            </p>
            {itemError && <p className="text-red-700">{itemError}</p>}
            <Button onClick={handleRestart} disabled={restarting}>
              {restarting ? "Restarting..." : "Restart on the current version"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const revealForCurrent = current ? reveals[current.id] : undefined;
  const isLastItem = index === visible.length - 1;

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{data.trainingTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Not a test — honest answers get you a tailored intro. You'll pick up tips
          as you go.
        </p>
      </div>

      <div className="space-y-1">
        <Progress value={progress} />
        <p className="text-xs text-muted-foreground text-right">
          {answeredRequired} / {requiredVisible.length} answered
        </p>
      </div>

      {current && (
        <Card>
          <CardHeader>
            {currentSection && (
              <Badge variant="outline" className="w-fit text-xs mb-1">
                {doc.sections.find((s) => s.id === currentSection)?.title}
              </Badge>
            )}
            <CardTitle className="text-lg">{current.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ── Item body ── */}
            {current.type === "info" && current.body && <InfoBody body={current.body} />}

            {current.type === "scale" && (
              <div className="space-y-2">
                {current.scaleLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={busy}
                    onClick={() => setDraft(i)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left text-sm transition-colors",
                      draft === i
                        ? "border-primary bg-primary/5 font-medium"
                        : "hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {current.type === "choice" &&
              current.options?.map((opt) => {
                const picked = locked
                  ? answers[current.id]?.value === opt.id
                  : draft === opt.id;
                const isCorrectOpt =
                  revealForCurrent && revealForCurrent.correctOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy || locked}
                    onClick={() => setDraft(opt.id)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left text-sm transition-colors",
                      picked && "border-primary bg-primary/5 font-medium",
                      !picked && !locked && "hover:bg-muted",
                      locked && isCorrectOpt && "border-green-500 bg-green-50",
                      locked && picked && !isCorrectOpt && "border-amber-400 bg-amber-50",
                    )}
                  >
                    {opt.label}
                    {locked && isCorrectOpt && (
                      <span className="ml-2 text-xs text-green-700">✓ the time-saver</span>
                    )}
                  </button>
                );
              })}

            {current.type === "multiselect" &&
              current.options?.map((opt) => {
                const arr = Array.isArray(draft) ? (draft as string[]) : [];
                const checked = arr.includes(opt.id);
                return (
                  <label key={opt.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      disabled={busy}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...arr, opt.id]
                          : arr.filter((x) => x !== opt.id);
                        setDraft(next);
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}

            {current.type === "text" && (
              <Textarea
                value={typeof draft === "string" ? draft : ""}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                rows={4}
                placeholder={current.optional ? "Optional" : "Your answer"}
              />
            )}

            {/* ── Reveal (locked knowledge choice) ── */}
            {revealForCurrent && (
              <div
                className={cn(
                  "rounded-md p-3 text-sm border flex gap-2",
                  revealForCurrent.wasCorrect
                    ? "bg-green-50 border-green-200 text-green-900"
                    : "bg-amber-50 border-amber-200 text-amber-900",
                )}
              >
                <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {revealForCurrent.wasCorrect ? "Spot on." : "Not quite —"}
                  </p>
                  {revealForCurrent.coaching && <p>{revealForCurrent.coaching}</p>}
                </div>
              </div>
            )}

            {itemError && <p className="text-sm text-red-700">{itemError}</p>}

            {/* ── Navigation ── */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={busy || index === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              {isLastItem && (locked || current.type !== "choice") ? (
                <Button type="button" onClick={handleSubmit} disabled={busy || !allComplete}>
                  {busy ? "Submitting..." : "Submit"}
                </Button>
              ) : (
                <Button type="button" onClick={handleForward} disabled={busy}>
                  {current.type === "choice" && !locked ? "Answer" : "Next"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit affordance when all required items are answered mid-quiz. */}
      {allComplete && !isLastItem && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting..." : "Submit questionnaire"}
          </Button>
        </div>
      )}
    </div>
  );
}
