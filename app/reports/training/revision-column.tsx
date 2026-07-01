"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TrainingRecords } from "@/generated/prisma_client/client";
import { Badge } from "@/components/ui/badge";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { currentRevision } from "@/lib/services/trainingCompliance";

/**
 * Is this completion recorded against a superseded revision?
 * Needs the record's training to carry its `revisions` list and
 * `requiresRetrainingOnRevision`. Mirrors the logic used on the employee
 * training tabs so reports and profiles agree.
 */
export function isRevisionOutOfDate(
  record: TrainingRecordsWithRelations,
): boolean {
  const t = record.training;
  if (!t?.revisions?.length) return false;
  const revLites = t.revisions.map((r) => ({
    id: r.id,
    effectiveDate: new Date(r.effectiveDate as unknown as string),
    createdAt: new Date(r.createdAt as unknown as string),
    overrideRequiresRetraining: r.overrideRequiresRetraining,
  }));
  const cur = currentRevision(revLites, new Date());
  if (!cur) return false;
  const requiresRetraining =
    cur.overrideRequiresRetraining ?? t.requiresRetrainingOnRevision;
  if (!requiresRetraining) return false;
  return record.revisionId !== null && record.revisionId !== cur.id;
}

/**
 * Column showing which revision a training record was completed against.
 * Typed as `ColumnDef<TrainingRecords>` so it can be appended to the existing
 * report column arrays; the runtime rows are `TrainingRecordsWithRelations`.
 */
export const revisionColumn: ColumnDef<TrainingRecords> = {
  id: "revision",
  header: "Revision",
  accessorFn: (row) =>
    (row as TrainingRecordsWithRelations).revision?.revisionLabel ?? "—",
  cell: ({ row }) => {
    const record = row.original as TrainingRecordsWithRelations;
    const label = record.revision?.revisionLabel ?? "—";
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span>{label}</span>
        {isRevisionOutOfDate(record) && (
          <Badge variant="destructive" className="text-xs">
            Update Needed
          </Badge>
        )}
      </div>
    );
  },
  meta: {
    headerText: "Revision",
  },
};
