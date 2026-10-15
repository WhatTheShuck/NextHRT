"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AxiosError } from "axios";
import { Paperclip, RefreshCw } from "lucide-react";
import api from "@/lib/axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StaleEmail {
  jobId: number;
  status: "Pending" | "Failed";
  to: string;
  subject: string;
  createdAt: string;
  attempts: number;
  slots: string[];
  missingFiles: string[];
}

interface StoredAttachment {
  path: string;
  name: string;
  size: number;
}

interface StaleEmailsResponse {
  emails: StaleEmail[];
  missingAttachments: Record<string, StoredAttachment[]>;
}

interface ResendResponse {
  resent: number[];
  skipped: { jobId: number; reason: string }[];
}

const SLOT_LABELS: Record<string, string> = {
  employmentForms: "Employment forms",
  policeCheck: "Police check form",
};

// Onboarding emails (queued or failed) that point at compliance files which no
// longer exist. Once the forms are re-uploaded in onboarding settings, these
// can be resent with the current files.
export function MissingAttachmentsPageContent() {
  const [data, setData] = useState<StaleEmailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResendResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<StaleEmailsResponse>(
        "/api/onboarding-config/stale-emails",
      );
      setData(res.data);
    } catch {
      setError("Failed to check for emails with missing attachments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resend = async (jobIds: number[]) => {
    try {
      setBusy(true);
      setError(null);
      const res = await api.post<ResendResponse>(
        "/api/onboarding-config/stale-emails",
        { jobIds },
      );
      setResult(res.data);
      // Resent rows drop out of the list locally rather than reloading, so
      // the result and any skip reasons stay visible.
      const resent = new Set(res.data.resent);
      setData((prev) =>
        prev && { ...prev, emails: prev.emails.filter((e) => !resent.has(e.jobId)) },
      );
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error ?? "Resend failed."
          : "Resend failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const emails = data?.emails ?? [];
  const missingUploads = Object.entries(data?.missingAttachments ?? {}).flatMap(
    ([slot, list]) => list.map((a) => ({ slot, ...a })),
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Paperclip className="h-7 w-7" />
              Missing Attachments
            </h1>
            <p className="text-muted-foreground mt-1">
              Onboarding emails whose attached forms no longer exist on the
              server. They have failed, or will fail, until resent with the
              forms that are uploaded now.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {missingUploads.length > 0 && (
          <Alert variant="destructive" data-tour="missing-uploads">
            <AlertDescription>
              <p>
                These uploaded forms are also missing — remove and re-upload
                them in{" "}
                <Link
                  href="/admin/settings?tab=onboarding"
                  className="font-medium underline underline-offset-2"
                >
                  App Settings &rsaquo; Onboarding
                </Link>{" "}
                before resending:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {missingUploads.map((a) => (
                  <li key={a.path}>
                    {SLOT_LABELS[a.slot] ?? a.slot}: {a.name}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card data-tour="stale-emails">
          <CardHeader>
            <CardTitle className="text-base">
              Emails waiting on missing forms ({emails.length})
            </CardTitle>
            <CardDescription>
              Each email gets the forms currently uploaded; the rest of the
              email (wording, calendar invite) is unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && emails.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing waiting — every queued email&apos;s attachments are in place.
              </p>
            )}
            <ul className="space-y-2">
              {emails.map((e) => (
                <li
                  key={e.jobId}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium" title={e.subject}>
                      {e.subject || "(no subject)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      To {e.to} · queued {new Date(e.createdAt).toLocaleString()} ·{" "}
                      {e.status === "Failed" ? (
                        <span className="text-destructive">Failed</span>
                      ) : (
                        "Pending"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Missing: {e.missingFiles.join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Will attach:{" "}
                      {e.slots.length > 0
                        ? e.slots.map((s) => SLOT_LABELS[s] ?? s).join(", ")
                        : "nothing — no forms uploaded"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => resend([e.jobId])}
                  >
                    Resend
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4">
              <Button
                data-tour="resend-all"
                disabled={busy || emails.length === 0}
                onClick={() => resend(emails.map((e) => e.jobId))}
              >
                {busy ? "Resending…" : "Resend all with current files"}
              </Button>
              {result && result.resent.length > 0 && (
                <span className="text-sm text-green-600">
                  {result.resent.length} email{result.resent.length !== 1 ? "s" : ""}{" "}
                  queued —{" "}
                  <Link href="/admin/email/log" className="underline underline-offset-2">
                    track them in the Email Log
                  </Link>
                  .
                </span>
              )}
            </div>
            {result && result.skipped.length > 0 && (
              <ul className="space-y-0.5 text-xs text-destructive">
                {result.skipped.map((s) => (
                  <li key={s.jobId}>
                    Not resent ({emails.find((e) => e.jobId === s.jobId)?.to ?? `email ${s.jobId}`}): {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
