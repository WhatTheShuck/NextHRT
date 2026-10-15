"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ban, Mail, Paperclip, RefreshCw, RotateCcw } from "lucide-react";

type EmailStatus =
  | "Sent"
  | "Queued"
  | "Scheduled"
  | "Retrying"
  | "Sending"
  | "Failed"
  | "Cancelled";

interface EmailEntry {
  id: number;
  status: EmailStatus;
  to: string;
  cc: string | null;
  subject: string;
  attachmentCount: number;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  scheduledAt: string;
  completedAt: string | null;
}

interface EmailDetail extends EmailEntry {
  bcc: string | null;
  replyTo: string | null;
  html: string | null;
  text: string | null;
  attachments: { filename: string; isFile: boolean; exists: boolean }[];
  messageId: string | null;
}

const STATUS_VARIANTS: Record<EmailStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Sent: "default",
  Queued: "outline",
  Scheduled: "outline",
  Retrying: "secondary",
  Sending: "secondary",
  Failed: "destructive",
  Cancelled: "outline",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 25;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// When the email went (or will go) out, phrased for its status.
function whenLabel(e: EmailEntry): string {
  if (e.status === "Sent" || e.status === "Failed") return formatDateTime(e.completedAt);
  if (e.status === "Scheduled" || e.status === "Retrying") {
    return `due ${formatDateTime(e.scheduledAt)}`;
  }
  return "—";
}

export function EmailLogPageContent() {
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (filter !== "all") params.set("status", filter);
      if (search) params.set("q", search);
      const res = await api.get<{ emails: EmailEntry[]; total: number }>(
        `/api/admin/emails?${params}`,
      );
      setEmails(res.data.emails);
      setTotal(res.data.total);
    } catch {
      setError("Failed to load the email log.");
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Mail className="h-7 w-7" />
              Email Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Every email HRT has sent, queued, or failed to send. Template test
              sends aren&apos;t listed here — they appear in the Admin Logs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            data-tour="email-log-filters"
            value={filter}
            onValueChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
          >
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            data-tour="email-log-search"
            placeholder="Search recipient or subject…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sm:w-72"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-md border" data-tour="email-log-list">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">To</th>
                <th className="text-left p-2 font-medium">Subject</th>
                <th className="text-left p-2 font-medium">Queued</th>
                <th className="text-left p-2 font-medium">Sent / due</th>
              </tr>
            </thead>
            <tbody>
              {!loading && emails.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No emails found
                  </td>
                </tr>
              )}
              {emails.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/30"
                >
                  <td className="p-2 whitespace-nowrap">
                    <Badge variant={STATUS_VARIANTS[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="p-2 max-w-[14rem] truncate" title={e.to}>
                    {e.to}
                  </td>
                  <td className="p-2 max-w-md">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate" title={e.subject}>
                        {e.subject || "(no subject)"}
                      </span>
                      {e.attachmentCount > 0 && (
                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {e.status === "Failed" && e.errorMessage && (
                      <p className="truncate text-xs text-destructive" title={e.errorMessage}>
                        {e.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {whenLabel(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2" data-tour="email-log-list">
          {!loading && emails.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">No emails found</p>
          )}
          {emails.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className="w-full rounded-md border bg-card p-3 text-left text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant={STATUS_VARIANTS[e.status]}>{e.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.createdAt)}
                </span>
              </div>
              <p className="truncate font-medium">{e.subject || "(no subject)"}</p>
              <p className="truncate text-xs text-muted-foreground">To {e.to}</p>
              {e.status === "Failed" && e.errorMessage && (
                <p className="truncate text-xs text-destructive">{e.errorMessage}</p>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {total} email{total !== 1 ? "s" : ""}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      <EmailDetailDialog
        emailId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={fetchEmails}
      />
    </div>
  );
}

function EmailDetailDialog({
  emailId,
  onClose,
  onChanged,
}: {
  emailId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setError(null);
    try {
      const res = await api.get<EmailDetail>(`/api/admin/emails/${id}`);
      setEmail(res.data);
    } catch {
      setError("Failed to load this email.");
    }
  }, []);

  useEffect(() => {
    setEmail(null);
    if (emailId != null) load(emailId);
  }, [emailId, load]);

  // Retry / cancel reuse the background-job actions — the email *is* the job.
  const runAction = async (action: "retry" | "cancel") => {
    if (emailId == null) return;
    try {
      setBusy(true);
      setError(null);
      await api.post(`/api/jobs/${emailId}`, { action });
      await load(emailId);
      onChanged();
    } catch {
      setError(`Failed to ${action} this email.`);
    } finally {
      setBusy(false);
    }
  };

  const missingFiles = email?.attachments.filter((a) => a.isFile && !a.exists) ?? [];
  const canRetry = email?.status === "Failed" || email?.status === "Cancelled";
  const canCancel =
    email?.status === "Queued" || email?.status === "Scheduled" || email?.status === "Retrying";

  return (
    <Dialog open={emailId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">
            {email ? email.subject || "(no subject)" : "Loading…"}
          </DialogTitle>
          <DialogDescription>Email #{emailId}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {email && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={STATUS_VARIANTS[email.status]}>{email.status}</Badge>
                {email.attempts > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {email.attempts} failed attempt{email.attempts !== 1 ? "s" : ""}
                  </span>
                )}
              </dd>
              <dt className="text-muted-foreground">To</dt>
              <dd className="break-all">{email.to}</dd>
              {email.cc && (
                <>
                  <dt className="text-muted-foreground">Cc</dt>
                  <dd className="break-all">{email.cc}</dd>
                </>
              )}
              {email.bcc && (
                <>
                  <dt className="text-muted-foreground">Bcc</dt>
                  <dd className="break-all">{email.bcc}</dd>
                </>
              )}
              {email.replyTo && (
                <>
                  <dt className="text-muted-foreground">Reply-to</dt>
                  <dd className="break-all">{email.replyTo}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Queued</dt>
              <dd>{formatDateTime(email.createdAt)}</dd>
              <dt className="text-muted-foreground">Sent / due</dt>
              <dd>{whenLabel(email)}</dd>
              {email.messageId && (
                <>
                  <dt className="text-muted-foreground">Message ID</dt>
                  <dd className="break-all font-mono text-xs">{email.messageId}</dd>
                </>
              )}
            </dl>

            {email.errorMessage && email.status !== "Sent" && (
              <Alert variant="destructive">
                <AlertDescription className="break-words">
                  {email.errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {email.attachments.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">Attachments</p>
                <ul className="space-y-0.5">
                  {email.attachments.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span>{a.filename}</span>
                      {a.isFile && !a.exists && (
                        <span className="text-xs font-medium text-destructive">
                          missing on server
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {missingFiles.length > 0 && email.status !== "Sent" && (
                  <p className="text-xs text-muted-foreground">
                    Retrying as-is will fail again.{" "}
                    <Link
                      href="/admin/email/attachments"
                      className="font-medium underline underline-offset-2"
                    >
                      Resend with the current files
                    </Link>{" "}
                    instead.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <p className="font-medium">Body</p>
              {email.html ? (
                // Sandboxed with no permissions: the body is rendered, never run.
                <iframe
                  title="Email body"
                  sandbox=""
                  srcDoc={email.html}
                  className="h-96 w-full rounded-md border bg-white"
                />
              ) : (
                <pre className="whitespace-pre-wrap rounded-md border p-3 text-xs">
                  {email.text ?? "(empty)"}
                </pre>
              )}
            </div>

            {(canRetry || canCancel) && (
              <div className="flex justify-end gap-2">
                {canRetry && (
                  <Button variant="outline" disabled={busy} onClick={() => runAction("retry")}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
                {canCancel && (
                  <Button variant="outline" disabled={busy} onClick={() => runAction("cancel")}>
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel send
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
