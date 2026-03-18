"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Archive, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ArchivalCount {
  count: number;
  cutoffDate: string;
  retentionYears: number;
}

export function HistoryArchivalCard() {
  const [data, setData] = useState<ArchivalCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function fetchCount() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/archival-count");
      if (!res.ok) throw new Error("Failed to fetch count");
      setData(await res.json());
    } catch {
      setMessage({ text: "Failed to load archival count", ok: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCount();
  }, []);

  async function runArchival() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "HISTORY_ARCHIVAL" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to enqueue");
      }
      setMessage({ text: "History archival job enqueued", ok: true });
      await fetchCount();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to enqueue archival",
        ok: false,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          History Archival
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <p className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking archive…
          </div>
        ) : data ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Retention policy:{" "}
              <span className="font-medium text-foreground">
                {data.retentionYears} year{data.retentionYears !== 1 ? "s" : ""}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Records before:{" "}
              <span className="font-medium text-foreground">
                {format(new Date(data.cutoffDate), "dd MMM yyyy")}
              </span>
            </p>
            <p className="text-sm">
              {data.count === 0 ? (
                <span className="text-muted-foreground">
                  No history records eligible for archival.
                </span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{data.count.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">
                    history record{data.count !== 1 ? "s" : ""} eligible for deletion.
                  </span>
                </>
              )}
            </p>
          </div>
        ) : null}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={loading || running || (data?.count ?? 0) === 0}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enqueueing…
                </>
              ) : (
                "Run archival now"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Run history archival?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{data?.count.toLocaleString()}</strong> history record
                {data?.count !== 1 ? "s" : ""} older than{" "}
                {data ? format(new Date(data.cutoffDate), "dd MMM yyyy") : ""} (
                {data?.retentionYears}-year retention policy). This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={runArchival}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete records
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
