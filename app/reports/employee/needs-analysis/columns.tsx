"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequirementItem } from "./page";

export const columns: ColumnDef<RequirementItem>[] = [
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "type",
    accessorFn: (row) => (row.type === "training" ? "Training" : "Ticket"),
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <div className="flex items-center gap-2">
          {type === "training" ? (
            <FileText className="h-4 w-4 text-blue-500" />
          ) : (
            <CreditCard className="h-4 w-4 text-green-500" />
          )}
          <Badge variant={type === "training" ? "secondary" : "outline"}>
            {type === "training" ? "Training" : "Ticket"}
          </Badge>
        </div>
      );
    },
    meta: {
      headerText: "Type",
    },
  },
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "name",
    meta: {
      headerText: "Name",
    },
  },
  {
    header: "Category",
    accessorKey: "category",
    accessorFn: (row) => row.category || "",
    cell: ({ row }) => {
      const item = row.original;
      const category = row.getValue("category") as string;

      if (item.type === "training" && category) {
        return <span className="text-sm">{category}</span>;
      }
      return <span className="text-muted-foreground">-</span>;
    },
    meta: {
      headerText: "Category",
    },
  },
  {
    header: "Ticket Code",
    accessorKey: "ticketCode",
    accessorFn: (row) => row.ticketCode || "",
    cell: ({ row }) => {
      const item = row.original;
      const ticketCode = row.getValue("ticketCode") as string;

      if (item.type === "ticket" && ticketCode) {
        return <span className="text-sm">{ticketCode}</span>;
      }
      return <span className="text-muted-foreground">-</span>;
    },
    meta: {
      headerText: "Ticket Code",
    },
  },
  {
    header: "Required By Department",
    accessorKey: "departmentName",
    cell: ({ row }) => {
      const departmentName = row.getValue("departmentName") as string;
      return <span className="text-sm">{departmentName}</span>;
    },
    meta: {
      headerText: "Department",
    },
  },
  {
    header: "Required By Location",
    accessorKey: "locationName",
    cell: ({ row }) => {
      const locationName = row.getValue("locationName") as string;
      return <span className="text-sm">{locationName}</span>;
    },
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
          Status <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "isCompleted",
    accessorFn: (row) => {
      if (row.isExempted) return "Exempted";
      return row.isCompleted ? "Completed" : "Required";
    },
    cell: ({ row }) => {
      const isCompleted = row.original.isCompleted;
      const isExempted = row.original.isExempted;

      if (isExempted) {
        return (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-purple-500" />
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200"
            >
              Exempted
            </Badge>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Badge variant="default" className="bg-green-100 text-green-800">
                Completed
              </Badge>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-orange-500" />
              <Badge variant="destructive">Required</Badge>
            </>
          )}
        </div>
      );
    },
    meta: {
      headerText: "Status",
    },
  },
];
