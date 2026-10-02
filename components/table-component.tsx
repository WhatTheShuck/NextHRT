"use client";
import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  appTableFeatures,
  useTable,
  RowData,
} from "@/lib/table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LandscapeHint } from "@/components/ui/landscape-hint";

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  onSortedDataChange?: (sortedData: TData[], isSorted: boolean) => void;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  onSortedDataChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  React.useEffect(() => {
    if (onSortedDataChange) {
      const sortedRows = table.getRowModel().rows.map((row) => row.original);
      onSortedDataChange(sortedRows, sorting.length > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, data]);

  return (
    <div>
      <LandscapeHint />
      <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
