"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EmployeeTrainingRow } from "../record-rows";
import { formatDate, sortableHeader } from "../column-helpers";

export const columns: ColumnDef<EmployeeTrainingRow>[] = [
  {
    accessorKey: "title",
    header: sortableHeader<EmployeeTrainingRow>("Training"),
    meta: { headerText: "Training" },
  },
  {
    accessorKey: "category",
    header: sortableHeader<EmployeeTrainingRow>("Category"),
    meta: { headerText: "Category" },
  },
  {
    id: "dateCompleted",
    accessorFn: (row) => row.dateCompleted,
    header: sortableHeader<EmployeeTrainingRow>("Date Completed"),
    cell: ({ row }) => formatDate(row.original.dateCompleted),
    meta: { headerText: "Date Completed" },
  },
  {
    accessorKey: "trainer",
    header: sortableHeader<EmployeeTrainingRow>("Trainer"),
    meta: { headerText: "Trainer" },
  },
  {
    id: "revision",
    accessorFn: (row) =>
      row.revisionOutOfDate
        ? `${row.revisionLabel} (Update Needed)`
        : row.revisionLabel,
    header: "Revision",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 flex-wrap">
        <span>{row.original.revisionLabel}</span>
        {row.original.revisionOutOfDate && (
          <Badge variant="destructive" className="text-xs">
            Update Needed
          </Badge>
        )}
      </div>
    ),
    meta: { headerText: "Revision" },
  },
];
