"use client";

import { useEmployee } from "../employee-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { HistoryRecordDetailsDialog } from "@/components/dialogs/history-record-details-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HistoryWithRelations } from "@/lib/types";

export function HistoryTab() {
  const { employee } = useEmployee();
  const [historyRecords, setHistoryRecords] = useState<HistoryWithRelations[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] =
    useState<HistoryWithRelations | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [includeOrphaned, setIncludeOrphaned] = useState(false);

  const limit = 20;

  useEffect(() => {
    if (employee?.id) {
      setPage(0);
      fetchHistoryRecords();
    }
  }, [employee?.id, includeOrphaned]);

  useEffect(() => {
    if (employee?.id) {
      fetchHistoryRecords();
    }
  }, [page]);

  const fetchHistoryRecords = async () => {
    if (!employee?.id) return;

    setLoading(true);
    setError(null);

    try {
      const offset = page * limit;
      const response = await fetch(
        `/api/history/employee/${employee.id}?limit=${limit}&offset=${offset}&includeOrphaned=${includeOrphaned}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch history records");
      }

      const data = await response.json();
      setHistoryRecords(data.data);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (record: HistoryWithRelations) => {
    setSelectedRecord(record);
    setIsDetailsOpen(true);
  };

  const getActionVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "default";
      case "update":
        return "secondary";
      case "delete":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getTableDisplayName = (tableName: string) => {
    switch (tableName) {
      case "Employee":
        return "Personal Details";
      case "TrainingRecords":
        return "Training Record";
      case "TicketRecords":
        return "Ticket Record";
      default:
        return tableName;
    }
  };

  const getRecordDescription = (record: HistoryWithRelations) => {
    if (
      record.tableName === "TicketRecords" ||
      record.tableName === "TrainingRecords"
    ) {
      const oldData = parseJsonSafely(record.oldValues || "");
      const newData = parseJsonSafely(record.newValues || "");

      if (record.action === "DELETE" && oldData) {
        if (record.tableName === "TicketRecords") {
          const ticketName = oldData.ticket?.ticketName || oldData.ticketName;
          const ticketCode = oldData.ticket?.ticketCode || oldData.ticketCode;
          return ticketName || ticketCode || "Ticket Record";
        }
        if (record.tableName === "TrainingRecords") {
          const trainingTitle =
            oldData.training?.title || oldData.trainingTitle;
          return trainingTitle || "Training Record";
        }
      }

      if (record.action === "CREATE" && newData) {
        if (record.tableName === "TicketRecords") {
          const ticketName = newData.ticket?.ticketName || newData.ticketName;
          const ticketCode = newData.ticket?.ticketCode || newData.ticketCode;
          return ticketName || ticketCode || "Ticket Record";
        }
        if (record.tableName === "TrainingRecords") {
          const trainingTitle =
            newData.training?.title || newData.trainingTitle;
          return trainingTitle || "Training Record";
        }
      }
    }

    return getTableDisplayName(record.tableName);
  };

  const parseJsonSafely = (jsonString?: string) => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  if (loading && page === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-center border-b pb-3 last:border-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-16" />
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
          <CardTitle>Edit History</CardTitle>
          <CardDescription>Error loading history records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const paginationControls = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(page - 1)}
        disabled={page === 0 || loading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(page + 1)}
        disabled={!hasMore || loading}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Edit History</CardTitle>
              <CardDescription>
                Showing {historyRecords.length} of {totalCount} history record
                {totalCount !== 1 ? "s" : ""}
                {includeOrphaned && " (including deleted records)"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-orphaned"
                  checked={includeOrphaned}
                  onCheckedChange={setIncludeOrphaned}
                  disabled={loading}
                />
                <Label htmlFor="include-orphaned" className="text-sm">
                  Include deleted records
                </Label>
              </div>
              {paginationControls}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No history records found
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">
                        {getRecordDescription(record)}
                      </p>
                      <Badge
                        variant={getActionVariant(record.action)}
                        className="shrink-0"
                      >
                        {record.action}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
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
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(record)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-center pt-2">{paginationControls}</div>
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Modified By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {getRecordDescription(record)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionVariant(record.action)}>
                            {record.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.user?.name || record.user?.email || "System"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.timestamp), "PPp")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <HistoryRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
