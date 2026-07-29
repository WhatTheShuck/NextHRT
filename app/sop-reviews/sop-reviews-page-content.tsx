"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
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
import { ClipboardCheck } from "lucide-react";

interface QueueRow {
  id: number;
  submittedAt: string | null;
  employee: {
    id: number;
    preferredFirstName: string | null;
    legalFirstName: string;
    preferredLastName: string | null;
    legalLastName: string;
  };
  revision: {
    id: number;
    revisionLabel: string;
    trainingId: number;
    training: { title: string };
  };
}

export function SopReviewsPageContent() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<QueueRow[]>("/api/sop-assessments?scope=queue")
      .then((r) => setRows(r.data))
      .catch(() => setError("Failed to load the review queue"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          SOP Reviews
        </h1>
        <p className="text-muted-foreground mt-1">
          Submitted SOP assessments waiting for your mark.
        </p>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No submissions waiting. You only see SOPs you are a designated
              trainer for.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>SOP</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.employee.preferredFirstName || row.employee.legalFirstName}{" "}
                    {row.employee.preferredLastName || row.employee.legalLastName}
                  </TableCell>
                  <TableCell>
                    {row.revision.training.title.replace(/ - Task Sheet$/, "")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.revision.revisionLabel}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm">
                      <Link href={`/sop-reviews/${row.id}`}>Mark</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
