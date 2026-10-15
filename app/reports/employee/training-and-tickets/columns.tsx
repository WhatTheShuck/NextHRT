"use client";

import { ColumnDef } from "@/lib/table";
import { Badge } from "@/components/ui/badge";
import { EmployeeCombinedRow } from "../record-rows";
import { formatDate, sortableHeader } from "../column-helpers";

export const columns: ColumnDef<EmployeeCombinedRow>[] = [
  {
    accessorKey: "type",
    header: sortableHeader<EmployeeCombinedRow>("Type"),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {row.original.type}
      </Badge>
    ),
    meta: { headerText: "Type" },
  },
  {
    accessorKey: "name",
    header: sortableHeader<EmployeeCombinedRow>("Name"),
    meta: { headerText: "Name" },
  },
  {
    accessorKey: "reference",
    header: sortableHeader<EmployeeCombinedRow>("Category / Code"),
    meta: { headerText: "Category / Code" },
  },
  {
    id: "date",
    accessorFn: (row) => row.date,
    header: sortableHeader<EmployeeCombinedRow>("Completed / Issued"),
    cell: ({ row }) => formatDate(row.original.date),
    meta: { headerText: "Completed / Issued" },
  },
  {
    id: "expiryDate",
    accessorFn: (row) => row.expiryDate,
    header: sortableHeader<EmployeeCombinedRow>("Expiry Date"),
    cell: ({ row }) => formatDate(row.original.expiryDate),
    meta: { headerText: "Expiry Date" },
  },
  {
    accessorKey: "status",
    header: sortableHeader<EmployeeCombinedRow>("Status"),
    cell: ({ row }) =>
      row.original.needsAttention ? (
        <Badge variant="destructive" className="text-xs">
          {row.original.status}
        </Badge>
      ) : (
        <span>{row.original.status}</span>
      ),
    meta: { headerText: "Status" },
  },
  {
    accessorKey: "detail",
    header: "Trainer / Licence No.",
    meta: { headerText: "Trainer / Licence No." },
  },
];
