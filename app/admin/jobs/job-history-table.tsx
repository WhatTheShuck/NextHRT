"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, History, RotateCcw, Ban } from "lucide-react";
import { format } from "date-fns";

interface BackgroundJob {
  id: number;
  type: string;
  status: string;
  payload: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  attempts: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "outline",
  Running: "secondary",
  Completed: "default",
  Failed: "destructive",
  Cancelled: "outline",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  EXEMPTION_EXPIRY: "Exemption Expiry",
  TICKET_EXPIRY: "Ticket Expiry",
  REQUIREMENTS_CACHE_REBUILD: "Cache Rebuild",
  REQUIREMENTS_CACHE_INVALIDATE: "Cache Invalidate",
  INACTIVE_EMPLOYEE_CHECK: "Inactive Check",
  ORPHANED_IMAGE_CLEANUP: "Image Cleanup",
  HISTORY_ARCHIVAL: "History Archival",
  REEVALUATE_PENDING_APPROVALS: "Reevaluate Approvals",
  SEND_EMAIL: "Send Email",
};

const PAGE_SIZE = 20;

export function JobHistoryTable() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/jobs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  const runAction = useCallback(
    async (jobId: number, action: "retry" | "cancel") => {
      setActioningId(jobId);
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error(`Failed to ${action} job`);
        await fetchJobs();
      } finally {
        setActioningId(null);
      }
    },
    [fetchJobs],
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Job History
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(JOB_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchJobs}
              disabled={loading}
              className="h-8 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Queued</th>
                <th className="text-left pb-2 font-medium">Duration</th>
                <th className="text-left pb-2 font-medium">Result / Error</th>
                <th className="text-right pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No jobs found
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4">
                    <span className="font-medium">
                      {JOB_TYPE_LABELS[job.type] ?? job.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"}>
                        {job.status}
                      </Badge>
                      {job.attempts > 0 && (
                        <span
                          className="text-xs text-muted-foreground"
                          title={`${job.attempts} failed attempt${job.attempts !== 1 ? "s" : ""}`}
                        >
                          ×{job.attempts}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {format(new Date(job.createdAt), "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {formatDuration(job.startedAt, job.completedAt)}
                  </td>
                  <td className="py-2 max-w-xs truncate text-muted-foreground text-xs">
                    {job.status === "Failed"
                      ? job.errorMessage
                      : job.resultSummary
                        ? (() => {
                            try {
                              return JSON.stringify(JSON.parse(job.resultSummary));
                            } catch {
                              return job.resultSummary;
                            }
                          })()
                        : "—"}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {(job.status === "Failed" || job.status === "Cancelled") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={actioningId === job.id}
                        onClick={() => runAction(job.id, "retry")}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                    {job.status === "Pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={actioningId === job.id}
                        onClick={() => runAction(job.id, "cancel")}
                      >
                        <Ban className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {jobs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No jobs found</p>
          )}
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {JOB_TYPE_LABELS[job.type] ?? job.type}
                </span>
                <div className="flex items-center gap-1.5">
                  {job.attempts > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ×{job.attempts}
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"}>
                    {job.status}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Queued: {format(new Date(job.createdAt), "dd MMM yyyy HH:mm")}</div>
                <div>Duration: {formatDuration(job.startedAt, job.completedAt)}</div>
                {job.status === "Failed" && job.errorMessage && (
                  <div className="text-destructive truncate">{job.errorMessage}</div>
                )}
              </div>
              {(job.status === "Failed" ||
                job.status === "Cancelled" ||
                job.status === "Pending") && (
                <div className="mt-2">
                  {job.status === "Pending" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={actioningId === job.id}
                      onClick={() => runAction(job.id, "cancel")}
                    >
                      <Ban className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={actioningId === job.id}
                      onClick={() => runAction(job.id, "retry")}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">
              {total} job{total !== 1 ? "s" : ""}
            </span>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
