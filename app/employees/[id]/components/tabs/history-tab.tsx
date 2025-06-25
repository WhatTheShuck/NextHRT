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
import { Eye, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
      setPage(0); // Reset to first page when toggling
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
    // For records that might not be directly tied to this employee anymore
    if (
      record.tableName === "TicketRecords" ||
      record.tableName === "TrainingRecords"
    ) {
      const oldData = parseJsonSafely(record.oldValues || "");
      const newData = parseJsonSafely(record.newValues || "");

      // For deleted records, try to get info from oldValues
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

      // For created records, try to get info from newValues
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
          <CardDescription>Loading history records...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading...
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Edit History</CardTitle>
              <CardDescription>
                Showing {historyRecords.length} of {totalCount} history record
                {totalCount !== 1 ? "s" : ""}
                {includeOrphaned && " (including deleted records)"}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
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
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1}
                </span>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {historyRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No history records found
                  </TableCell>
                </TableRow>
              ) : (
                historyRecords.map((record) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* History Record Details Dialog */}
      <HistoryRecordDetailsDialog
        record={selectedRecord}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
