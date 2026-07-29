"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookOpenCheck } from "lucide-react";

interface MySopRow {
  taskSheetId: number;
  title: string;
  taskSheetDone: boolean;
  practicalDone: boolean;
  ready: boolean;
  currentRevisionId: number | null;
  assessment: {
    id: number;
    status: string;
    revisionId: number;
    onCurrentRevision: boolean;
  } | null;
}

function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

// ─── Stale-revision confirm (responsive Dialog/Drawer) ───────────────────────

interface StaleRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestart: () => void;
  onContinue: () => void;
  busy: boolean;
}

function StaleRevisionDialog({
  open,
  onOpenChange,
  onRestart,
  onContinue,
  busy,
}: StaleRevisionDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const title = "Newer revision available";
  const description =
    "A newer revision of this SOP is now current. Restart on the current revision? Restarting discards your existing answers.";

  const actions = (
    <>
      <Button type="button" onClick={onRestart} disabled={busy}>
        {busy ? "Restarting…" : "Restart on current revision"}
      </Button>
      <Button type="button" variant="outline" onClick={onContinue} disabled={busy}>
        Continue anyway
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>{actions}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Per-row status + action ──────────────────────────────────────────────────

function DoneBadge({ done }: { done: boolean }) {
  return done ? (
    <Badge className="bg-green-600 text-white">Complete</Badge>
  ) : (
    <span className="text-muted-foreground">–</span>
  );
}

function statusBadge(row: MySopRow) {
  if (row.assessment) {
    switch (row.assessment.status) {
      case "InProgress":
        return <Badge variant="secondary">In progress</Badge>;
      case "Submitted":
        return <Badge variant="secondary">Awaiting marking</Badge>;
      case "ChangesRequested":
        return <Badge className="bg-amber-500 text-white">Changes requested</Badge>;
    }
  }
  if (row.taskSheetDone && row.practicalDone) {
    return <Badge className="bg-green-600 text-white">Complete</Badge>;
  }
  return <span className="text-muted-foreground">–</span>;
}

export function MySopsPageContent() {
  const router = useRouter();
  const [rows, setRows] = useState<MySopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTrainingId, setBusyTrainingId] = useState<number | null>(null);
  // Row whose Resume needs the stale-revision confirmation.
  const [staleRow, setStaleRow] = useState<MySopRow | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    api
      .get<MySopRow[]>("/api/sop-assessments")
      .then((r) => setRows(r.data))
      .catch((err) => {
        if (apiError(err, "") === "NO_LINKED_EMPLOYEE") setNotLinked(true);
        else setError(apiError(err, "Failed to load your SOPs"));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (row: MySopRow) => {
    setBusyTrainingId(row.taskSheetId);
    try {
      const res = await api.post<{ id: number }>("/api/sop-assessments", {
        trainingId: row.taskSheetId,
      });
      router.push(`/my-sops/${res.data.id}`);
    } catch (err) {
      toast.error(apiError(err, "Failed to start assessment"));
      setBusyTrainingId(null);
    }
  };

  const handleRestart = async () => {
    if (!staleRow?.assessment) return;
    setRestarting(true);
    try {
      const res = await api.patch<{ id: number }>(
        `/api/sop-assessments/${staleRow.assessment.id}`,
        { action: "restart" },
      );
      router.push(`/my-sops/${res.data.id}`);
    } catch (err) {
      toast.error(apiError(err, "Failed to restart assessment"));
      setRestarting(false);
      setStaleRow(null);
    }
  };

  const actionCell = (row: MySopRow) => {
    const busy = busyTrainingId === row.taskSheetId;

    if (row.assessment) {
      const { status, onCurrentRevision, id } = row.assessment;
      if (status === "Submitted") {
        return (
          <Button asChild variant="outline" size="sm">
            <Link href={`/my-sops/${id}`}>View</Link>
          </Button>
        );
      }
      // InProgress / ChangesRequested
      const label = status === "ChangesRequested" ? "Fix answers" : "Resume";
      if (!onCurrentRevision) {
        return (
          <Button
            type="button"
            size="sm"
            onClick={() => setStaleRow(row)}
            disabled={busy}
          >
            {label}
          </Button>
        );
      }
      return (
        <Button asChild size="sm" aria-disabled={busy}>
          <Link href={`/my-sops/${id}`}>{label}</Link>
        </Button>
      );
    }

    if (row.taskSheetDone && row.practicalDone) {
      return null; // status column already shows Complete
    }

    if (!row.ready) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button type="button" size="sm" disabled>
                  Not available yet
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              The procedure PDF or questions haven&apos;t been set up for this
              SOP yet.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        onClick={() => handleStart(row)}
        disabled={busy}
      >
        {busy ? "Starting…" : "Start"}
      </Button>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <BookOpenCheck className="h-6 w-6" />
          My SOPs
        </h1>
        <p className="text-muted-foreground mt-1">
          Standard operating procedures required for your role. Read the
          procedure, complete the assessment, and a designated trainer will mark
          your answers.
        </p>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">
          {error}
        </div>
      )}

      {notLinked && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Your account isn&apos;t linked to an employee record — ask an
              admin to link it.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !notLinked && rows.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No SOPs are required for your department and location.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !notLinked && rows.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SOP</TableHead>
                <TableHead>Task Sheet</TableHead>
                <TableHead>Practical</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.taskSheetId}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <DoneBadge done={row.taskSheetDone} />
                  </TableCell>
                  <TableCell>
                    <DoneBadge done={row.practicalDone} />
                  </TableCell>
                  <TableCell>{statusBadge(row)}</TableCell>
                  <TableCell className="text-right">{actionCell(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StaleRevisionDialog
        open={staleRow !== null}
        onOpenChange={(open) => {
          if (!open) setStaleRow(null);
        }}
        onRestart={handleRestart}
        onContinue={() => {
          if (staleRow?.assessment) router.push(`/my-sops/${staleRow.assessment.id}`);
        }}
        busy={restarting}
      />
    </div>
  );
}
