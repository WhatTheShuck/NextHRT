"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Clock } from "lucide-react";
import { useState } from "react";

interface ScheduledJob {
  type: string;
  label: string;
  description: string;
  schedule: string;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    type: "EXEMPTION_EXPIRY",
    label: "Exemption Expiry",
    description: "Marks exemptions as expired when their end date has passed.",
    schedule: "Daily at midnight",
  },
  {
    type: "TICKET_EXPIRY",
    label: "Ticket Expiry",
    description: "Summarises expired and expiring-soon ticket records.",
    schedule: "Daily at midnight",
  },
  {
    type: "INACTIVE_EMPLOYEE_CHECK",
    label: "Inactive Employee Check",
    description: "Sets employees as inactive when their finish date has passed.",
    schedule: "Daily at midnight",
  },
  {
    type: "ORPHANED_IMAGE_CLEANUP",
    label: "Orphaned Image Cleanup",
    description: "Removes image records and files no longer linked to any record.",
    schedule: "Weekly — Sunday at 2am",
  },
  {
    type: "REQUIREMENTS_CACHE_REBUILD",
    label: "Requirements Cache Rebuild",
    description: "Rebuilds the full requirements cache for all employees.",
    schedule: "On boot / on demand",
  },
];

export function ScheduledJobsCard() {
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function triggerJob(type: string) {
    setRunning(type);
    setMessage(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to enqueue job");
      }
      setMessage({ text: `${type} enqueued`, ok: true });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to enqueue job",
        ok: false,
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Scheduled Jobs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {message && (
          <p
            className={`text-sm mb-3 ${message.ok ? "text-green-600" : "text-destructive"}`}
          >
            {message.text}
          </p>
        )}
        <div className="space-y-3">
          {SCHEDULED_JOBS.map((job) => (
            <div
              key={job.type}
              className="flex items-start justify-between gap-4 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{job.label}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {job.schedule}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {job.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerJob(job.type)}
                disabled={running === job.type}
                className="shrink-0"
              >
                <Play className="h-3 w-3 mr-1" />
                Run now
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
