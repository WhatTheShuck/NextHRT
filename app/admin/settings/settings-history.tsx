"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { HistoryWithRelations } from "@/lib/types";

const LIMIT = 20;

function parseJson(s?: string | null): Record<string, string> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function formatKey(key: string) {
  // "matching.email.enabled" → "Matching › Email › Enabled"
  return key
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" › ");
}

export function SettingsHistory() {
  const [records, setRecords] = useState<HistoryWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = page * LIMIT;
      const res = await fetch(
        `/api/history?tableName=AppSetting&limit=${LIMIT}&offset=${offset}`,
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setRecords(data.data);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const paginationControls = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => p - 1)}
        disabled={page === 0 || loading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => p + 1)}
        disabled={!hasMore || loading}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  if (loading && page === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4 items-center border-b pb-3 last:border-0"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive py-8">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Change History</CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "No changes recorded yet"
                : `${totalCount} change${totalCount !== 1 ? "s" : ""} recorded`}
            </CardDescription>
          </div>
          {totalCount > LIMIT && paginationControls}
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No setting changes have been recorded yet.
          </p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {records.map((record) => {
                const oldVal = parseJson(record.oldValues)?.value;
                const newVal = parseJson(record.newValues)?.value;
                return (
                  <div
                    key={record.id}
                    className="border rounded-lg p-4 space-y-2 text-sm"
                  >
                    <p className="font-medium">
                      {formatKey(record.recordId)}
                    </p>
                    <div className="text-muted-foreground space-y-1">
                      {oldVal !== undefined && (
                        <p>
                          <span className="font-medium text-foreground">
                            From:
                          </span>{" "}
                          <code className="bg-muted px-1 rounded">
                            {oldVal}
                          </code>
                        </p>
                      )}
                      {newVal !== undefined && (
                        <p>
                          <span className="font-medium text-foreground">
                            To:
                          </span>{" "}
                          <code className="bg-muted px-1 rounded">
                            {newVal}
                          </code>
                        </p>
                      )}
                      <p>
                        <span className="font-medium text-foreground">By:</span>{" "}
                        {record.user?.name || record.user?.email || "System"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          Date:
                        </span>{" "}
                        {format(new Date(record.timestamp), "PPp")}
                      </p>
                    </div>
                  </div>
                );
              })}
              {totalCount > LIMIT && (
                <div className="flex justify-center pt-2">
                  {paginationControls}
                </div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Previous Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const oldVal = parseJson(record.oldValues)?.value;
                    const newVal = parseJson(record.newValues)?.value;
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {formatKey(record.recordId)}
                        </TableCell>
                        <TableCell>
                          {oldVal !== undefined ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                              {oldVal}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {newVal !== undefined ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                              {newVal}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.user?.name ||
                            record.user?.email ||
                            "System"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.timestamp), "PPp")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalCount > LIMIT && (
                <div className="flex justify-end pt-4">
                  {paginationControls}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
