// Shared TanStack Table (v9) setup. v9 makes table features opt-in and threads
// the feature set through every type, so the app defines it once here and
// re-exports the types with it applied.
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type Column as TanstackColumn,
  type RowData,
  type ColumnDef as TanstackColumnDef,
} from "@tanstack/react-table";

export const appTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns,
  filterFns,
});

export type AppTableFeatures = typeof appTableFeatures;

// `any` default matches v8's `ColumnDef<TData, TValue = unknown>` usage, where
// arrays of columns with mixed value types are common.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ColumnDef<TData extends RowData, TValue = any> = TanstackColumnDef<
  AppTableFeatures,
  TData,
  TValue
>;
export type Column<TData extends RowData, TValue = unknown> = TanstackColumn<
  AppTableFeatures,
  TData,
  TValue
>;

export {
  flexRender,
  useTable,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
