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
import { AddProgramDialog } from "@/components/dialogs/program/add-program-dialog";
import { EditProgramDialog } from "@/components/dialogs/program/edit-program-dialog";
import { DeleteProgramDialog } from "@/components/dialogs/program/delete-program-dialog";
import { useEffect, useState } from "react";
import { Program } from "@/generated/prisma_client/client";
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

const ProgramsDirectory = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isProgramAddDialogOpen, setIsProgramAddDialogOpen] = useState(false);
  const [isProgramEditDialogOpen, setIsProgramEditDialogOpen] = useState(false);
  const [isProgramDeleteDialogOpen, setIsProgramDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Program | null>(null);
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
        const { data: programsRes } = await api.get<Program[]>("/api/programs");
        setPrograms(programsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditProgram = (record: Program) => {
    setSelectedRecord(record);
    setIsProgramEditDialogOpen(true);
  };

  const handleDeleteProgram = (record: Program) => {
    setSelectedRecord(record);
    setIsProgramDeleteDialogOpen(true);
  };

  const columns: ColumnDef<Program>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableColumnHeader column={column} label="Program Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "ticketNumber",
      header: ({ column }) => (
        <SortableColumnHeader column={column} label="Ticket Number" />
      ),
      cell: ({ row }) => row.original.ticketNumber || "—",
    },
    {
      accessorKey: "infoRequired",
      header: "Info Required",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground">
          {row.original.infoRequired || "—"}
        </span>
      ),
    },
    {
      accessorKey: "requiresReferenceUser",
      header: ({ column }) => (
        <SortableColumnHeader column={column} label="Reference User" />
      ),
      cell: ({ row }) => (row.original.requiresReferenceUser ? "Required" : "—"),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        return filterValue === "required"
          ? row.getValue(columnId) === true
          : row.getValue(columnId) === false;
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
      cell: ({ row }) => (
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditProgram(row.original)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteProgram(row.original)}
            title="Delete program"
          >
            <Trash className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: programs,
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

  const mobileHiddenCols = new Set(["infoRequired", "requiresReferenceUser"]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Software Programs</CardTitle>
              <CardDescription>
                Manage the software-access program catalogue used by onboarding.
                Showing {table.getFilteredRowModel().rows.length} of{" "}
                {programs.length} program
                {programs.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsProgramAddDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
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
              Loading programs...
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          mobileHiddenCols.has(header.id)
                            ? "hidden md:table-cell"
                            : undefined
                        }
                      >
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
                        ? "No programs match your filters"
                        : "No programs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            mobileHiddenCols.has(cell.column.id)
                              ? "hidden md:table-cell"
                              : undefined
                          }
                        >
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
      <AddProgramDialog
        open={isProgramAddDialogOpen}
        onOpenChange={setIsProgramAddDialogOpen}
        onProgramAdded={(program) => {
          setPrograms((prev) => [...prev, program]);
        }}
      />

      <EditProgramDialog
        open={isProgramEditDialogOpen}
        onOpenChange={setIsProgramEditDialogOpen}
        program={selectedRecord}
        onProgramUpdated={(updatedProgram) => {
          setPrograms((prev) =>
            prev.map((program) =>
              program.id === updatedProgram.id
                ? { ...program, ...updatedProgram }
                : program,
            ),
          );
        }}
      />

      <DeleteProgramDialog
        open={isProgramDeleteDialogOpen}
        onOpenChange={setIsProgramDeleteDialogOpen}
        program={selectedRecord}
        onProgramDeleted={(deletedProgram) => {
          setPrograms((prev) =>
            prev.filter((program) => program.id !== deletedProgram.id),
          );
        }}
      />
    </div>
  );
};

export default ProgramsDirectory;
