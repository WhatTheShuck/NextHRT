"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReplayReport } from "@/lib/services/workdayImportService";
import { FIELD_LABELS } from "@/lib/workday/labels";
import type { LineField } from "@/lib/workday/suggestions";
import { ArrowRightLeft, Download, FileSpreadsheet, ListX, Loader2, Upload } from "lucide-react";

interface ImportSummary {
  id: number;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  rowCount: number;
  status: "Open" | "Superseded" | "Discarded";
  runCount: number;
}

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error ?? fallback;
}

export function ImportUploadContent() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<ImportSummary[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ImportSummary[]>("/api/workday-import")
      .then((res) => setImports(res.data))
      .catch(() => setImports([]));
  }, []);

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<{ id: number }>("/api/workday-import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      router.push(`/admin/org-chart/import/${res.data.id}`);
    } catch (err) {
      setError(errorMessage(err, "Upload failed."));
      setUploading(false);
    }
  };

  const open = imports?.find((i) => i.status === "Open");

  // ── Moving decisions between copies (snapshot → prod) ──
  const replayRef = useRef<HTMLInputElement>(null);
  const [pendingBundle, setPendingBundle] = useState<{ name: string; data: unknown } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayReport, setReplayReport] = useState<ReplayReport | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const chooseBundle = async (file: File) => {
    setReplayError(null);
    setReplayReport(null);
    try {
      setPendingBundle({ name: file.name, data: JSON.parse(await file.text()) });
    } catch {
      setReplayError("That file isn't valid JSON.");
    }
  };

  const replay = async () => {
    if (!pendingBundle) return;
    setReplaying(true);
    try {
      const res = await api.post<ReplayReport>("/api/workday-import/decisions", pendingBundle.data, { timeout: 300000 });
      setReplayReport(res.data);
      setPendingBundle(null);
      const list = await api.get<ImportSummary[]>("/api/workday-import");
      setImports(list.data);
    } catch (err) {
      setReplayError(errorMessage(err, "Replay failed."));
      setPendingBundle(null);
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workday Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a Workday org chart export to get suggested updates. Nothing changes until you tick it and apply.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild data-tour="import-rules-link">
          <Link href="/admin/org-chart/import/rules">
            <ListX className="h-4 w-4 mr-2" />
            Ignore rules
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            role="button"
            tabIndex={0}
            data-tour="import-upload"
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file && !uploading) upload(file);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/40"
            }`}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="font-medium">{uploading ? "Reading the export…" : "Drop the Workday export here, or click to choose"}</p>
            <p className="text-xs text-muted-foreground">
              .xlsx with Unique Identifier, Name, Reports To and Line Detail 1 columns. Location is never imported.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          {open && (
            <p className="text-xs text-muted-foreground mt-3">
              Uploading replaces the open import ({open.fileName}). Anything already applied stays applied.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-tour="import-decisions">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Move decisions to another copy of HRT
          </CardTitle>
          <CardDescription>
            For reviewing on a prod snapshot and landing it on prod in one go. Export here, then replay on the target. Replay
            only runs on a copy of the same HRT, re-checks every line, and skips anything that has changed since.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/workday-import/decisions" download>
                <Download className="h-4 w-4 mr-2" />
                Export decisions
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => replayRef.current?.click()} disabled={replaying}>
              {replaying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Replay decisions…
            </Button>
            <input
              ref={replayRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) chooseBundle(file);
                e.target.value = "";
              }}
            />
          </div>
          {replayError && <p className="text-sm text-destructive">{replayError}</p>}
          {replayReport && <ReplaySummary report={replayReport} />}
        </CardContent>
      </Card>

      <Dialog open={!!pendingBundle} onOpenChange={(o) => !o && !replaying && setPendingBundle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replay {pendingBundle?.name}?</DialogTitle>
            <DialogDescription>
              This copies the Workday links, ignore rules and delegated-access grants, then re-applies every change that was
              applied there, in the same order. Each line is checked against this HRT first; anything that has changed is
              skipped and listed. It stops before changing anything if this isn&apos;t a copy of the same HRT.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingBundle(null)} disabled={replaying}>
              Cancel
            </Button>
            <Button onClick={replay} disabled={replaying}>
              {replaying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Replay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card data-tour="import-recent">
        <CardHeader>
          <CardTitle className="text-base">Recent imports</CardTitle>
          <CardDescription>Older imports stay viewable as a record of what was applied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {imports === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {imports?.length === 0 && <p className="text-sm text-muted-foreground">No imports yet.</p>}
          {imports?.map((i) => (
            <Link
              key={i.id}
              href={`/admin/org-chart/import/${i.id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{i.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(i.uploadedAt), "d MMM yyyy, h:mm a")} · {i.uploadedBy ?? "Unknown"} · {i.rowCount} people ·{" "}
                  {i.runCount} apply run{i.runCount === 1 ? "" : "s"}
                </p>
              </div>
              <Badge variant={i.status === "Open" ? "default" : "outline"}>{i.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReplaySummary({ report }: { report: ReplayReport }) {
  const applied = report.runs.reduce((n, r) => n + r.applied, 0);
  const skipped = report.runs.flatMap((r) => r.skipped);
  const alreadyDone = skipped.filter((s) => s.status === "alreadyDone").length;
  const changed = skipped.filter((s) => s.status === "changed");
  const errors = report.runs.filter((r) => r.error);
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
      <p className="font-medium">Replay finished</p>
      <p className="text-muted-foreground">
        {report.links} link{report.links === 1 ? "" : "s"} · {report.ignoreRules} ignore rule
        {report.ignoreRules === 1 ? "" : "s"} · {applied} change{applied === 1 ? "" : "s"} applied across {report.runs.length} apply
        run{report.runs.length === 1 ? "" : "s"} · {report.grantsCreated} grant{report.grantsCreated === 1 ? "" : "s"} created
        {alreadyDone > 0 && <> · {alreadyDone} already in place</>}
      </p>
      {changed.length > 0 && (
        <details className="text-amber-700 dark:text-amber-400" open>
          <summary className="cursor-pointer">
            {changed.length} change{changed.length === 1 ? "" : "s"} skipped because HRT has changed since the export
          </summary>
          <ul className="mt-1 text-xs space-y-0.5 max-h-48 overflow-auto">
            {changed.map((s) => (
              <li key={s.lineId}>
                <span className="font-medium">{s.employeeName ?? "Unknown"}</span> · {FIELD_LABELS[s.field as LineField] ?? s.field}: {s.value}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-1">These show up again on the replayed import if they still apply. Review them there.</p>
        </details>
      )}
      {errors.map((r, i) => (
        <p key={i} className="text-destructive text-xs">
          {r.fileName} ({r.at}): {r.error}
        </p>
      ))}
      {report.importId !== null && (
        <Link href={`/admin/org-chart/import/${report.importId}`} className="underline text-sm">
          Open the replayed import
        </Link>
      )}
    </div>
  );
}
