"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeWithRequirementStatus } from "@/lib/types";

export const columns: ColumnDef<EmployeeWithRequirementStatus>[] = [
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
    accessorKey: "firstName",
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
    accessorKey: "lastName",
    meta: {
      headerText: "Last Name",
    },
  },
  { header: "Title", accessorKey: "title" },
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
    accessorKey: "location.name",
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
    accessorKey: "department.name",
    meta: {
      headerText: "Department",
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
    accessorKey: "requirementStatus",
    cell: ({ row }) => {
      const status = row.original.requirementStatus;

      if (status === "Exempted") {
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

      if (status === "Completed") {
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="default" className="bg-green-100 text-green-800">
              Completed
            </Badge>
          </div>
        );
      }

      // Required
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <Badge variant="destructive">Required</Badge>
        </div>
      );
    },
    meta: {
      headerText: "Status",
    },
  },
];
