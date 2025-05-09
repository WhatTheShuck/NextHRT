"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Employee } from "@/generated/prisma_client";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const columns: ColumnDef<Employee>[] = [
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
  { header: "Title", accessorKey: "Title" },
  {
    header: "Work Area",
    accessorKey: "WorkAreaID",
    // Optional: Add format function if you want to transform the WorkAreaID
    // format: (value: number) => `Area ${value}`,
  },
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
    accessorKey: "Location",
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
    accessorKey: "Department",
    meta: {
      headerText: "Department",
    },
  },
];
