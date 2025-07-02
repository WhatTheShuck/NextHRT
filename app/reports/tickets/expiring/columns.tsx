"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TicketRecords } from "@/generated/prisma_client";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const columns: ColumnDef<TicketRecords>[] = [
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          First Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "ticketHolder.firstName",
    meta: {
      headerText: "First Name",
    },
  },
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "ticketHolder.lastName",
    meta: {
      headerText: "Last Name",
    },
  },
  { header: "Title", accessorKey: "ticketHolder.title" },
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Location <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "ticketHolder.location.name",
    meta: {
      headerText: "Location",
    },
  },
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Department
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "ticketHolder.department.name",
    meta: {
      headerText: "Department",
    },
  },
  {
    id: "dateIssued",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date Issued
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorFn: (row) => {
      const date = row.dateIssued;
      return date instanceof Date
        ? date.toLocaleDateString()
        : new Date(date).toLocaleDateString();
    },
    meta: {
      headerText: "Date Completed",
    },
  },
  {
    id: "expiryDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Expiry Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorFn: (row) => {
      const date = row.expiryDate;
      if (!date) return "N/A";
      return date instanceof Date
        ? date.toLocaleDateString()
        : new Date(date).toLocaleDateString();
    },
    meta: {
      headerText: "Expiry Date",
    },
  },
  { header: "Licence Number", accessorKey: "licenseNumber" },
];
