"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface TemplateVersion {
  id: number;
  timestamp: string;
  action: string;
  userId: string | null;
  userName: string | null;
  subject: string;
  body: string;
  isActive: boolean;
}

/**
 * Past versions of one template, with restore.
 *
 * Each entry is the copy as it stood *before* that change — the snapshot
 * restoring it puts back — which is why the newest entry is what the template
 * looked like before the most recent edit, not its current text.
 */
export function TemplateHistoryDialog({
  templateKey,
  templateName,
  open,
  onClose,
  onRestored,
}: {
  templateKey: string;
  templateName: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const body = (
    <HistoryList
      templateKey={templateKey}
      open={open}
      onRestored={() => {
        onRestored();
        onClose();
      }}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>{templateName}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Version history</DrawerTitle>
          <DrawerDescription>{templateName}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}

function HistoryList({
  templateKey,
  open,
  onRestored,
}: {
  templateKey: string;
  open: boolean;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<TemplateVersion[]>(
        `/api/email-templates/${encodeURIComponent(templateKey)}/history`,
      );
      setVersions(res.data);
    } catch {
      setError("Could not load the version history.");
    } finally {
      setLoading(false);
    }
  }, [templateKey]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const restore = async (id: number) => {
    try {
      setRestoring(id);
      setError(null);
      await api.post(
        `/api/email-templates/${encodeURIComponent(templateKey)}/history/${id}/restore`,
      );
      onRestored();
    } catch {
      setError("Could not restore that version.");
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error !== null && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {versions.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          This template has not been edited yet, so there is nothing to restore.
        </p>
      )}

      {versions.map((v) => {
        const isOpen = expanded === v.id;
        return (
          <div key={v.id} className="rounded-md border">
            <div className="flex items-center gap-2 p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label={isOpen ? "Hide copy" : "Show copy"}
                onClick={() => setExpanded(isOpen ? null : v.id)}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {v.subject || (
                    <span className="text-muted-foreground">(no subject)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(v.timestamp), "d MMM yyyy, h:mm a")}
                  {v.userName !== null && ` — ${v.userName}`}
                </p>
              </div>
              {v.action === "REVERT" && (
                <Badge variant="outline" className="shrink-0">
                  before revert
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={restoring !== null}
                onClick={() => restore(v.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {restoring === v.id ? "Restoring..." : "Restore"}
              </Button>
            </div>
            {isOpen && (
              <pre className="max-h-64 overflow-auto border-t bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
                {v.body}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
