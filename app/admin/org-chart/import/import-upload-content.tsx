"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, ListX, Loader2, Upload } from "lucide-react";

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

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workday Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a Workday org chart export to get suggested updates. Nothing changes until you tick it and apply.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
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

      <Card>
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
