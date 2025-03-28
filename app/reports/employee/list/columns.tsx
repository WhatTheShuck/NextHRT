"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Employee } from "@prisma/client";

export const columns: ColumnDef<Employee>[] = [
  { header: "First Name", accessorKey: "firstName" },
  { header: "Last Name", accessorKey: "lastName" },
  { header: "Title", accessorKey: "Title" },
  {
    header: "Work Area",
    accessorKey: "WorkAreaID",
    // Optional: Add format function if you want to transform the WorkAreaID
    // format: (value: number) => `Area ${value}`,
  },
  {
    header: "Location",
    accessorKey: "Location",
  },
  {
    header: "Department",
    accessorKey: "Department",
  },
];
