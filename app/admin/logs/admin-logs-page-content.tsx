"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Info, AlertTriangle, XCircle } from "lucide-react";

interface AppLog {
  id: number;
  message: string;
  severity: "Info" | "Warning" | "Error";
  source: string | null;
  createdAt: string;
}

function severityIcon(severity: string) {
  if (severity === "Error") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (severity === "Warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function severityBadgeVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "Error") return "destructive";
  if (severity === "Warning") return "outline";
  return "secondary";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdminLogsPageContent() {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const fetchLogs = (severity?: string) => {
    setLoading(true);
    const params = severity && severity !== "all" ? `?severity=${severity}` : "";
    api
      .get<AppLog[]>(`/api/admin/logs${params}`)
      .then((res) => setLogs(res.data))
      .catch(() => setError("Failed to load logs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(severityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (value: string) => {
    setSeverityFilter(value);
    fetchLogs(value);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Logs</h1>
            <p className="text-muted-foreground mt-1">System messages and warnings.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(severityFilter)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={severityFilter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="Info">Info</SelectItem>
              <SelectItem value="Warning">Warning</SelectItem>
              <SelectItem value="Error">Error</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && <p className="text-muted-foreground">Loading...</p>}

        {!loading && !error && logs.length === 0 && (
          <p className="text-muted-foreground">No log entries found.</p>
        )}

        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-md border bg-card p-3 text-sm"
            >
              {severityIcon(log.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={severityBadgeVariant(log.severity)} className="text-xs">
                    {log.severity}
                  </Badge>
                  {log.source && (
                    <span className="text-xs text-muted-foreground font-mono">{log.source}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="break-words">{log.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
