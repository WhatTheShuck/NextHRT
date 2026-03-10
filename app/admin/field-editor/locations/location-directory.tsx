"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Search } from "lucide-react";
import { SortableColumnHeader } from "@/components/sortable-column-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AddLocationDialog } from "@/components/dialogs/location/add-location-dialog";
import { useEffect, useState, useMemo } from "react";
import { Location } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
import { EditLocationDialog } from "@/components/dialogs/location/edit-location-dialog";
import { DeleteLocationDialog } from "@/components/dialogs/location/delete-location-dialog";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface LocationWithCount extends Location {
  _count?: {
    employees: number;
    activeEmployees: number;
  };
}

const LocationsDirectory = () => {
  const [locations, setLocations] = useState<LocationWithCount[]>([]);
  const [isLocationAddDialogOpen, setIsLocationAddDialogOpen] = useState(false);
  const [isLocationEditDialogOpen, setIsLocationEditDialogOpen] =
    useState(false);
  const [isLocationDeleteDialogOpen, setIsLocationDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<LocationWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "isActive", desc: true },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: locationsRes } =
          await api.get<LocationWithCount[]>("/api/locations");
        setLocations(locationsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditLocation = (record: LocationWithCount) => {
    setSelectedRecord(record);
    setIsLocationEditDialogOpen(true);
  };

  const handleDeleteLocation = (record: LocationWithCount) => {
    setSelectedRecord(record);
    setIsLocationDeleteDialogOpen(true);
  };

  const uniqueStates = useMemo(
    () => Array.from(new Set(locations.map((l) => l.state))).sort(),
    [locations],
  );

  const columns = useMemo<ColumnDef<LocationWithCount>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Location Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "state",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="State" />
        ),
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true;
          return row.getValue(columnId) === filterValue;
        },
        enableGlobalFilter: true,
      },
      {
        id: "totalEmployees",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Total Employees" />
        ),
        accessorFn: (row) => row._count?.employees ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "employee" : "employees"}`;
        },
        enableGlobalFilter: false,
      },
      {
        id: "activeEmployees",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Active Employees" />
        ),
        accessorFn: (row) => row._count?.activeEmployees ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "employee" : "employees"}`;
        },
        enableGlobalFilter: false,
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              row.original.isActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </span>
        ),
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true;
          return filterValue === "active"
            ? row.getValue(columnId) === true
            : row.getValue(columnId) === false;
        },
        enableGlobalFilter: false,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const employeeCount = row.original._count?.employees || 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditLocation(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteLocation(row.original)}
                disabled={employeeCount > 0}
                title={
                  employeeCount > 0
                    ? "Cannot delete location with assigned employees"
                    : "Delete location"
                }
              >
                <Trash className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: locations,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  const statusFilterValue =
    (table.getColumn("isActive")?.getFilterValue() as string) ?? "all";
  const stateFilterValue =
    (table.getColumn("state")?.getFilterValue() as string) ?? "all";

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Location Management</CardTitle>
              <CardDescription>
                Manage locations and view employee assignments. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {locations.length}{" "}
                location
                {locations.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsLocationAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={stateFilterValue}
              onValueChange={(value) => {
                table
                  .getColumn("state")
                  ?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilterValue}
              onValueChange={(value) => {
                table
                  .getColumn("isActive")
                  ?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading locations...
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center text-muted-foreground"
                    >
                      {globalFilter || columnFilters.length > 0
                        ? "No locations match your filters"
                        : "No locations found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Dialogs */}
      <AddLocationDialog
        open={isLocationAddDialogOpen}
        onOpenChange={setIsLocationAddDialogOpen}
        onLocationAdded={(loc) => {
          setLocations([
            ...locations,
            { ...loc, _count: { employees: 0, activeEmployees: 0 } },
          ]);
        }}
      />

      <EditLocationDialog
        open={isLocationEditDialogOpen}
        onOpenChange={setIsLocationEditDialogOpen}
        location={selectedRecord}
        onLocationUpdated={(updatedLoc) => {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === updatedLoc.id ? { ...loc, ...updatedLoc } : loc,
            ),
          );
        }}
      />

      <DeleteLocationDialog
        open={isLocationDeleteDialogOpen}
        onOpenChange={setIsLocationDeleteDialogOpen}
        location={selectedRecord}
        onLocationDeleted={(deletedDept) => {
          setLocations((prev) =>
            prev.filter((dept) => dept.id !== deletedDept.id),
          );
        }}
      />
    </div>
  );
};

export default LocationsDirectory;
