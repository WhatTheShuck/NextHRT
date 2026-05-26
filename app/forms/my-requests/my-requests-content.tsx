"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { authClient } from "@/lib/auth-client";
import { DataTable } from "@/components/table-component";
import { columns, MyRequest } from "./columns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Filter helpers ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["All", "Pending", "Approved", "Rejected", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const PERSPECTIVE_OPTIONS = ["All", "Submitted by me", "Submitted for me"] as const;
type PerspectiveFilter = (typeof PERSPECTIVE_OPTIONS)[number];

// ─── Component ────────────────────────────────────────────────────────────────

export function MyRequestsContent() {
  const { data: session } = authClient.useSession();

  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myEmployeeId, setMyEmployeeId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [perspectiveFilter, setPerspectiveFilter] =
    useState<PerspectiveFilter>("All");

  // Fetch linked employeeId for the current user (needed for perspective filter)
  useEffect(() => {
    if (!session?.user?.id) return;
    api
      .get(`/api/users/${session.user.id}`)
      .then((res) => setMyEmployeeId(res.data?.employee?.id ?? null))
      .catch(() => {}); // non-fatal — perspective filter degrades gracefully
  }, [session?.user?.id]);

  // Fetch all requests
  useEffect(() => {
    api
      .get<MyRequest[]>("/api/training-requests")
      .then((res) => setRequests(res.data))
      .catch(() => setError("Failed to load requests."))
      .finally(() => setLoading(false));
  }, []);

  // Client-side filtering
  const filtered = requests.filter((r) => {
    if (statusFilter !== "All" && r.approvalRequest.status !== statusFilter) {
      return false;
    }
    if (perspectiveFilter === "Submitted by me") {
      return r.approvalRequest.submittedByUserId === session?.user?.id;
    }
    if (perspectiveFilter === "Submitted for me") {
      return myEmployeeId != null && r.employeeId === myEmployeeId;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">My Requests</h1>
          <p className="text-muted-foreground mt-2">Training requests submitted by or for you</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-36" />
            </div>
            <div className="border rounded-md">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-6 p-3 border-b last:border-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    {statusFilter === "All" ? "All Statuses" : statusFilter}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  <p className="text-sm font-medium px-2 py-1 text-muted-foreground">
                    Filter by status
                  </p>
                  <ul>
                    {STATUS_OPTIONS.map((opt) => (
                      <li
                        key={opt}
                        className="flex items-center justify-between py-1.5 px-2 cursor-pointer hover:bg-accent rounded-md text-sm"
                        onClick={() => setStatusFilter(opt)}
                      >
                        <span>{opt === "All" ? "All Statuses" : opt}</span>
                        {statusFilter === opt && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>

              {/* Perspective filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    {perspectiveFilter === "All" ? "All Requests" : perspectiveFilter}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2">
                  <p className="text-sm font-medium px-2 py-1 text-muted-foreground">
                    Filter by perspective
                  </p>
                  <ul>
                    {PERSPECTIVE_OPTIONS.map((opt) => (
                      <li
                        key={opt}
                        className="flex items-center justify-between py-1.5 px-2 cursor-pointer hover:bg-accent rounded-md text-sm"
                        onClick={() => setPerspectiveFilter(opt)}
                      >
                        <span>{opt === "All" ? "All Requests" : opt}</span>
                        {perspectiveFilter === opt && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>

              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "request" : "requests"}
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No requests match the current filters.
              </p>
            ) : (
              <DataTable columns={columns} data={filtered} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
