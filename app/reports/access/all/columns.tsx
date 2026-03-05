"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeAccessInfo } from "@/lib/services/accessCheckService";

export const columns: ColumnDef<EmployeeAccessInfo>[] = [
  {
    accessorKey: "firstName",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        First Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: { headerText: "First Name" },
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Last Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: { headerText: "Last Name" },
  },
  {
    accessorKey: "department",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Department <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: { headerText: "Department" },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Location <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: { headerText: "Location" },
  },
  {
    accessorKey: "accessorCount",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Accessor Count <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    meta: { headerText: "Accessor Count" },
  },
  {
    accessorKey: "accessorNames",
    header: "Accessible By",
    meta: { headerText: "Accessible By" },
  },
];
