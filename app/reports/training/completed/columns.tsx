"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TrainingRecords } from "@/generated/prisma_client";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const columns: ColumnDef<TrainingRecords>[] = [
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
    accessorKey: "personTrained.firstName",
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
    accessorKey: "personTrained.lastName",
    meta: {
      headerText: "Last Name",
    },
  },
  { header: "Title", accessorKey: "personTrained.Title" },
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
    accessorKey: "personTrained.Location",
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
    accessorKey: "personTrained.Department",
    meta: {
      headerText: "Department",
    },
  },
  {
    id: "dateCompleted",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date Completed
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorFn: (row) => {
      const date = row.createdAt;
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
  {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Trainer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    accessorKey: "trainer",
    meta: {
      headerText: "Trainer",
    },
  },
];
