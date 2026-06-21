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
import { AddMedicalStandardDialog } from "@/components/dialogs/medical-standard/add-medical-standard-dialog";
import { EditMedicalStandardDialog } from "@/components/dialogs/medical-standard/edit-medical-standard-dialog";
import { DeleteMedicalStandardDialog } from "@/components/dialogs/medical-standard/delete-medical-standard-dialog";
import { useEffect, useState, useMemo } from "react";
import { MedicalStandard } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
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

interface MedicalStandardWithCount extends MedicalStandard {
  _count?: {
    onboardingRequests: number;
  };
}

const MedicalStandardDirectory = () => {
  const [medicalStandards, setMedicalStandards] = useState<
    MedicalStandardWithCount[]
  >([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<MedicalStandardWithCount | null>(null);
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
        const { data } =
          await api.get<MedicalStandardWithCount[]>("/api/medical-standards");
        setMedicalStandards(data);
      } catch (err) {
        console.error("Error fetching medical standards:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEdit = (record: MedicalStandardWithCount) => {
    setSelectedRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (record: MedicalStandardWithCount) => {
    setSelectedRecord(record);
    setIsDeleteDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<MedicalStandardWithCount>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "requests",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Requests" />
        ),
        accessorFn: (row) => row._count?.onboardingRequests ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "request" : "requests"}`;
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
          const requestCount = row.original._count?.onboardingRequests ?? 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(row.original)}
                disabled={requestCount > 0}
                title={
                  requestCount > 0
                    ? "Cannot delete medical standard referenced by onboarding requests"
                    : "Delete medical standard"
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
    data: medicalStandards,
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

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Medical Standard Management</CardTitle>
              <CardDescription>
                Manage medical standards available for onboarding requests.
                Showing {table.getFilteredRowModel().rows.length} of{" "}
                {medicalStandards.length} standard
                {medicalStandards.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Medical Standard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medical standards..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
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
              Loading medical standards...
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
                        ? "No medical standards match your filters"
                        : "No medical standards found"}
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
      <AddMedicalStandardDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onMedicalStandardAdded={(ms) => {
          setMedicalStandards([
            ...medicalStandards,
            { ...ms, _count: { onboardingRequests: 0 } },
          ]);
        }}
      />

      <EditMedicalStandardDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        medicalStandard={selectedRecord}
        onMedicalStandardUpdated={(updated) => {
          setMedicalStandards((prev) =>
            prev.map((ms) =>
              ms.id === updated.id ? { ...ms, ...updated } : ms,
            ),
          );
        }}
      />

      <DeleteMedicalStandardDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        medicalStandard={selectedRecord}
        onMedicalStandardDeleted={(deleted) => {
          setMedicalStandards((prev) =>
            prev.filter((ms) => ms.id !== deleted.id),
          );
        }}
      />
    </div>
  );
};

export default MedicalStandardDirectory;
