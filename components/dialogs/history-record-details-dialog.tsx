"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { HistoryWithRelations } from "@/lib/types";

interface HistoryRecordDetailsDialogProps {
  record: HistoryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoryRecordDetailsDialog({
  record,
  open,
  onOpenChange,
}: HistoryRecordDetailsDialogProps) {
  if (!record) return null;

  const parseJsonSafely = (jsonString?: string) => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
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

  const renderValueDifferences = (oldValues?: string, newValues?: string) => {
    const oldData = parseJsonSafely(oldValues);
    const newData = parseJsonSafely(newValues);

    if (!oldData || !newData) return null;

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // Compare all fields in newData
    Object.keys(newData).forEach((key) => {
      if (oldData[key] !== newData[key]) {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key],
        });
      }
    });

    return changes;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (
      typeof value === "string" &&
      value.includes("T") &&
      value.includes(":")
    ) {
      // Likely a date string
      try {
        return format(new Date(value), "PP");
      } catch {
        return value;
      }
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>History Record Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Section
                </label>
                <p>{getTableDisplayName(record.tableName)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Action
                </label>
                <div>
                  <Badge variant={getActionVariant(record.action)}>
                    {record.action}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Modified By
                </label>
                <p>{record.user?.name || record.user?.email || "System"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Date & Time
                </label>
                <p>{format(new Date(record.timestamp), "PPp")}</p>
              </div>
            </div>

            {record.action === "UPDATE" && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-medium mb-3">Changes Made</h3>
                  {(() => {
                    const changes = renderValueDifferences(
                      record.oldValues || undefined,
                      record.newValues || undefined,
                    );

                    if (!changes || changes.length === 0) {
                      return (
                        <p className="text-muted-foreground">
                          No detailed changes available
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {changes.map((change, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2 capitalize">
                              {change.field.replace(/([A-Z])/g, " $1").trim()}
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">
                                  Before:
                                </span>
                                <p className="font-mono bg-muted p-1 rounded mt-1">
                                  {formatValue(change.oldValue)}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  After:
                                </span>
                                <p className="font-mono bg-muted p-1 rounded mt-1">
                                  {formatValue(change.newValue)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {record.action === "CREATE" && record.newValues && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-medium mb-3">Record Created</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(
                        parseJsonSafely(record.newValues),
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {record.action === "DELETE" && record.oldValues && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-medium mb-3">Record Deleted</h3>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(
                        parseJsonSafely(record.oldValues),
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
