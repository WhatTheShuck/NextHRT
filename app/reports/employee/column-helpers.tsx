"use client";

import { ColumnDef, RowData } from "@/lib/table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The sortable header button the report tables use, factored out because the
 * per-employee reports need it on nearly every column.
 */
export function sortableHeader<T extends RowData>(label: string): ColumnDef<T>["header"] {
  const Header: ColumnDef<T>["header"] = ({ column }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label} <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
  return Header;
}

/** Renders a date, or a dash when there isn't one. */
export function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString() : "—";
}
