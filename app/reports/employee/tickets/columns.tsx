"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EmployeeTicketRow } from "../record-rows";
import { formatDate, sortableHeader } from "../column-helpers";

export const columns: ColumnDef<EmployeeTicketRow>[] = [
  {
    accessorKey: "ticketName",
    header: sortableHeader<EmployeeTicketRow>("Ticket"),
    meta: { headerText: "Ticket" },
  },
  {
    accessorKey: "ticketCode",
    header: sortableHeader<EmployeeTicketRow>("Code"),
    meta: { headerText: "Code" },
  },
  {
    id: "dateIssued",
    accessorFn: (row) => row.dateIssued,
    header: sortableHeader<EmployeeTicketRow>("Date Issued"),
    cell: ({ row }) => formatDate(row.original.dateIssued),
    meta: { headerText: "Date Issued" },
  },
  {
    id: "expiryDate",
    accessorFn: (row) => row.expiryDate,
    header: sortableHeader<EmployeeTicketRow>("Expiry Date"),
    cell: ({ row }) => formatDate(row.original.expiryDate),
    meta: { headerText: "Expiry Date" },
  },
  {
    accessorKey: "status",
    header: sortableHeader<EmployeeTicketRow>("Status"),
    cell: ({ row }) =>
      row.original.status === "Expired" ? (
        <Badge variant="destructive" className="text-xs">
          Expired
        </Badge>
      ) : (
        <span>{row.original.status}</span>
      ),
    meta: { headerText: "Status" },
  },
  {
    accessorKey: "licenseNumber",
    header: "Licence Number",
    meta: { headerText: "Licence Number" },
  },
];
